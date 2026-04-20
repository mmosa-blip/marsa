/**
 * Shared helper for computing the effective duration of a service
 * from its ordered list of task templates. Used by:
 *   - service-catalog listing API
 *   - project-templates listing + detail APIs
 *   - service-catalog detail page (client-side)
 *   - "لماذا X يوم" modal (client-side)
 *
 * Rules:
 *   sameDay tasks      → 0 extra days (skip)
 *   INDEPENDENT tasks  → 0 extra days (skip)
 *   SEQUENTIAL tasks   → add linearly
 *   PARALLEL tasks     → group consecutive PARALLEL tasks and take
 *                        the max of the group, then add that once
 */
export function computeServiceDuration(
  tasks: {
    defaultDuration: number;
    executionMode: string;
    sameDay: boolean;
  }[]
): number {
  let total = 0;
  let parallelMax = 0;

  for (const task of tasks) {
    if (task.sameDay) continue;
    if (task.executionMode === "INDEPENDENT") continue;

    if (task.executionMode === "PARALLEL") {
      parallelMax = Math.max(parallelMax, task.defaultDuration);
    } else {
      // SEQUENTIAL — flush any accumulated parallel group first
      if (parallelMax > 0) {
        total += parallelMax;
        parallelMax = 0;
      }
      total += task.defaultDuration;
    }
  }

  // Flush trailing parallel group
  if (parallelMax > 0) total += parallelMax;

  // A service with tasks always takes at least 1 working day even when
  // every task is sameDay=true (they still occupy the calendar day they
  // share). Without this floor the UI would show "0 يوم" which is
  // misleading.
  return tasks.length > 0 ? Math.max(total, 1) : total;
}

/**
 * Critical-path duration for a project given its ordered list of
 * services. Mirror of computeServiceDuration but one level up: each
 * service is an atom with its own duration + executionMode + background
 * flag, ordered by its template sortOrder / instance serviceOrder.
 *
 * Rules:
 *   isBackground === true   → skip (runs alongside the critical path)
 *   executionMode INDEPENDENT → skip (no scheduling contribution)
 *   executionMode PARALLEL    → group with adjacent PARALLELs and take
 *                                the max of the group
 *   executionMode SEQUENTIAL  → flush accumulated parallel group, then
 *                                add this service's duration
 *
 * Before this helper, project creation summed every service duration
 * when the project-level workflowType was SEQUENTIAL, regardless of
 * each service's own executionMode or isBackground flag. That ignored
 * parallel branches entirely and inflated project.endDate by the
 * duration of every parallel service (observed ~60 days of drift on
 * multi-branch projects).
 */
export function computeProjectDuration(
  services: {
    duration: number;
    executionMode: string;
    isBackground: boolean;
  }[]
): number {
  let total = 0;
  let parallelMax = 0;

  for (const svc of services) {
    if (svc.isBackground) continue;
    if (svc.executionMode === "INDEPENDENT") continue;

    if (svc.executionMode === "PARALLEL") {
      parallelMax = Math.max(parallelMax, svc.duration);
    } else {
      // SEQUENTIAL
      if (parallelMax > 0) {
        total += parallelMax;
        parallelMax = 0;
      }
      total += svc.duration;
    }
  }

  if (parallelMax > 0) total += parallelMax;
  return total;
}

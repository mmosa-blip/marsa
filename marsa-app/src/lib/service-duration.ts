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

  return total;
}

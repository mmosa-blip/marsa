/**
 * Pure, dependency-free state derivation for the gamified "city" feature.
 *
 * Used by both the client canvas (CityCanvas) and server endpoints
 * (cities-leaderboard) so they can never disagree on what counts as a
 * building's lifecycle state.
 *
 * Inputs accept Date | string | null so prisma values flow in unchanged
 * on the server and JSON-deserialised values flow in unchanged on the
 * client.
 */

export type BuildingState =
  | "COMPLETED"
  | "COLLAPSED" // endDate passed (or ON_HOLD), not done
  | "AT_RISK" // ≥ 80% of duration elapsed, not done
  | "TASK_LATE" // any task past dueDate, not COLLAPSED/AT_RISK
  | "IN_PROGRESS";

export interface BuildingStateInput {
  isComplete: boolean;
  status: string;
  startDate?: string | Date | null;
  contractStartDate?: string | Date | null;
  createdAt?: string | Date | null;
  endDate?: string | Date | null;
  contractEndDate?: string | Date | null;
  tasks?: { status: string; dueDate?: string | Date | null }[];
}

function toMillis(v: string | Date | null | undefined): number | null {
  if (!v) return null;
  const t = v instanceof Date ? v.getTime() : new Date(v).getTime();
  return Number.isFinite(t) ? t : null;
}

export function getBuildingState(p: BuildingStateInput): BuildingState {
  if (p.isComplete) return "COMPLETED";

  const now = Date.now();
  const end = toMillis(p.endDate ?? null) ?? toMillis(p.contractEndDate ?? null);

  // Project deadline blown OR explicitly paused → ruin.
  if (p.status === "ON_HOLD") return "COLLAPSED";
  if (end !== null && end < now) return "COLLAPSED";

  // 80%+ of contracted duration consumed but project not delivered.
  const start =
    toMillis(p.startDate ?? null) ??
    toMillis(p.contractStartDate ?? null) ??
    toMillis(p.createdAt ?? null);
  if (start !== null && end !== null && end > start) {
    const elapsed = now - start;
    const total = end - start;
    if (total > 0 && elapsed / total >= 0.8) return "AT_RISK";
  }

  // Any individual task past its due date → flag without yet ruining.
  const lateTasks = (p.tasks || []).filter((t) => {
    const due = toMillis(t.dueDate ?? null);
    return due !== null && due < now && t.status !== "DONE" && t.status !== "CANCELLED";
  }).length;
  if (lateTasks > 0) return "TASK_LATE";

  return "IN_PROGRESS";
}

/** "Every service has at least one task and all of them are DONE." */
export function isProjectComplete(p: {
  services?: { tasks?: { status: string }[] }[] | null;
}): boolean {
  const services = p.services || [];
  if (services.length === 0) return false;
  return services.every((s) => {
    const total = s.tasks?.length || 0;
    const done = s.tasks?.filter((t) => t.status === "DONE").length || 0;
    return total > 0 && done >= total;
  });
}

/**
 * Sort weight (lower = drawn first / further left on the canvas).
 * Reading right-to-left in Arabic, the most urgent state shows up first.
 */
export const STATE_ORDER: Record<BuildingState, number> = {
  COMPLETED: 0,
  IN_PROGRESS: 1,
  TASK_LATE: 2,
  AT_RISK: 3,
  COLLAPSED: 4,
};

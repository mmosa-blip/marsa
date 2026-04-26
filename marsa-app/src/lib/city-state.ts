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
  | "COLLAPSED"        // endDate truly blown — "guilty" (their fault)
  | "PAYMENT_FROZEN"   // a locked non-first installment is gating work — "innocent"
  | "ADMIN_PAUSED"     // status === ON_HOLD or isPaused — "innocent"
  | "AT_RISK"          // ≥ 80% of duration elapsed, not done
  | "TASK_LATE"        // any task past dueDate, not COLLAPSED/AT_RISK
  | "IN_PROGRESS";

export interface BuildingStateInput {
  isComplete: boolean;
  status: string;
  // Formal pause flag from the project (set by the operations room when
  // an admin pauses delivery). Independent of `status === ON_HOLD` —
  // either signal puts the project into ADMIN_PAUSED.
  isPaused?: boolean | null;
  // Server-derived: true if the project has a locked, unpaid, non-first
  // installment with a still-open linked task. Lifts the project into
  // PAYMENT_FROZEN regardless of dueDate or task lateness.
  paymentFrozen?: boolean | null;
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

  // Worst-first priority order:
  //   1. COLLAPSED       — actual deadline blown (project's fault)
  //   2. PAYMENT_FROZEN  — locked non-first installment (client's fault)
  //   3. ADMIN_PAUSED    — formally paused or ON_HOLD (admin decision)
  //   4. AT_RISK         — ≥ 80% of duration consumed
  //   5. TASK_LATE       — at least one task past its dueDate
  //   6. IN_PROGRESS     — default

  if (end !== null && end < now) return "COLLAPSED";
  if (p.paymentFrozen) return "PAYMENT_FROZEN";
  if (p.isPaused || p.status === "ON_HOLD") return "ADMIN_PAUSED";

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

/**
 * Server-side helper: derive `paymentFrozen` from a project's tasks. A
 * project is frozen when at least one of its tasks is gated by a locked,
 * unpaid, non-first installment.
 */
export function deriveProjectPaymentFrozen(tasks: {
  status: string;
  linkedInstallment?: { isLocked: boolean; order: number; paymentStatus: string } | null;
}[]): boolean {
  return tasks.some((t) => {
    const inst = t.linkedInstallment;
    if (!inst) return false;
    if (!inst.isLocked) return false;
    if (inst.order <= 0) return false; // first / upfront installment is fine
    if (inst.paymentStatus === "PAID") return false;
    if (t.status === "DONE" || t.status === "CANCELLED") return false;
    return true;
  });
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
  ADMIN_PAUSED: 4,
  PAYMENT_FROZEN: 5,
  COLLAPSED: 6,
};

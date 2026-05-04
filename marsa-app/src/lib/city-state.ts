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

import { getEffectiveDeadline } from "./project-deadline";

export type BuildingState =
  | "COMPLETED"
  | "COLLAPSED"        // endDate truly blown — "guilty" (their fault)
  | "PAYMENT_FROZEN"   // a locked non-first installment is gating work — "innocent"
  | "CLIENT_HOLD"      // admin-paused with reason CLIENT_REQUEST — "innocent"
  | "ADMIN_PAUSED"     // status === ON_HOLD or isPaused with no specific reason
  | "AT_RISK"          // ≥ 80% of duration elapsed, not done
  | "TASK_LATE"        // any task past dueDate, not COLLAPSED/AT_RISK
  | "IN_PROGRESS";

export interface BuildingStateInput {
  isComplete: boolean;
  status: string;
  // Formal pause flag from the project (set by the operations room when
  // an admin pauses delivery). Independent of `status === ON_HOLD` —
  // either signal puts the project into a paused state.
  isPaused?: boolean | null;
  // Server-derived: true if the project has a locked, unpaid, non-first
  // installment with a still-open linked task. Lifts the project into
  // PAYMENT_FROZEN regardless of dueDate or task lateness.
  paymentFrozen?: boolean | null;
  // Last-known reason for the pause, sourced from the open ProjectPause
  // history row (endDate IS NULL). Drives the visual differentiation
  // between PAYMENT_FROZEN, CLIENT_HOLD, and ADMIN_PAUSED — the admin's
  // stated reason wins when paymentFrozen=false (no actual locked
  // installment but admin called it a payment delay anyway).
  // Vocabulary: "PAYMENT_DELAY" | "CLIENT_REQUEST" | "ADMIN_DECISION"
  // | "OTHER" (legacy) | null
  pauseReason?: string | null;
  startDate?: string | Date | null;
  contractStartDate?: string | Date | null;
  createdAt?: string | Date | null;
  endDate?: string | Date | null;
  contractEndDate?: string | Date | null;
  // Live contract relation — fed in by APIs that include it. Read by
  // getEffectiveDeadline alongside the denormalised endDate fields.
  contract?: { endDate?: string | Date | null } | null;
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
  // Earliest of (project.endDate, project.contractEndDate, contract.endDate).
  // Earlier code used `endDate ?? contractEndDate`, which silently lost the
  // contract deadline whenever the internal plan window was extended past
  // the contracted end — see scripts/diagnose-collapsed.ts.
  const deadline = getEffectiveDeadline(p);
  const end = deadline ? deadline.getTime() : null;

  // Priority order — "innocent" states win first so we never blame a
  // team for a deadline that slipped while they were prevented from
  // working. The pause reason flows in from ProjectPause.reason (open
  // row) and refines the visual:
  //
  //   1. PAYMENT_FROZEN  — actual locked installment (auto-derived) OR
  //                        admin-paused with reason=PAYMENT_DELAY
  //                        (admin's stated reason is honored even when
  //                        paymentFrozen=false, e.g. project has no
  //                        contract row but the admin knows the client
  //                        owes a payment).
  //   2. CLIENT_HOLD     — admin-paused with reason=CLIENT_REQUEST
  //   3. ADMIN_PAUSED    — admin-paused with no specific reason or
  //                        reason=ADMIN_DECISION / OTHER (catch-all)
  //   4. COLLAPSED       — deadline blown with no protective state
  //   5. AT_RISK         — ≥ 80% of duration consumed
  //   6. TASK_LATE       — at least one task past its dueDate
  //   7. IN_PROGRESS     — default

  if (p.paymentFrozen) return "PAYMENT_FROZEN";
  if (p.isPaused || p.status === "ON_HOLD") {
    switch (p.pauseReason) {
      case "PAYMENT":
      case "PAYMENT_DELAY":  // legacy ProjectPause.reason value
        return "PAYMENT_FROZEN";
      case "CLIENT_REQUEST":
        return "CLIENT_HOLD";
      case "ADMIN_DECISION":
      case "OTHER":          // legacy ProjectPause.reason value
      case "OVERDUE_REVIEW": // accountability review on a missed deadline
      default:
        return "ADMIN_PAUSED";
    }
  }
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
  CLIENT_HOLD: 4,
  ADMIN_PAUSED: 5,
  PAYMENT_FROZEN: 6,
  COLLAPSED: 7,
};

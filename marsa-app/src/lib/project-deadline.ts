/**
 * Unified project-deadline arithmetic.
 *
 * A project carries up to three different "end dates":
 *   - `project.endDate`             — the internal plan window
 *   - `project.contractEndDate`     — the denormalised contract end on the
 *                                     project row, kept in sync with the
 *                                     linked Contract by mutations
 *   - `project.contract?.endDate`   — the live value on the Contract itself
 *
 * Earlier code picked them with `endDate ?? contractEndDate` — once the
 * internal plan window was extended past the contracted end, the contract
 * deadline fell silently out of view, and ~half of all overdue projects
 * stopped being recognised as such (see scripts/diagnose-collapsed.ts).
 *
 * Rule going forward — encoded here, called from every consumer:
 *
 *   The contract is binding; the internal plan is detail.
 *   Therefore the deadline is the **earliest** of all three sources.
 *
 * Callers don't have to remember which source to read; they call
 * `getEffectiveDeadline`, `isProjectOverdue`, or `daysRemainingForProject`
 * and let those agree on a single answer.
 */

export interface ProjectDeadlineInput {
  endDate?: Date | string | null;
  contractEndDate?: Date | string | null;
  contract?: { endDate?: Date | string | null } | null;
}

function asMillis(v: Date | string | null | undefined): number | null {
  if (!v) return null;
  const t = v instanceof Date ? v.getTime() : new Date(v).getTime();
  return Number.isFinite(t) ? t : null;
}

/**
 * The effective deadline of a project — the **earliest** non-null date
 * among project.endDate, project.contractEndDate, project.contract.endDate.
 * Returns null when no source has a value.
 */
export function getEffectiveDeadline(p: ProjectDeadlineInput): Date | null {
  const candidates = [p.endDate, p.contractEndDate, p.contract?.endDate]
    .map(asMillis)
    .filter((t): t is number => t !== null);
  if (candidates.length === 0) return null;
  return new Date(Math.min(...candidates));
}

/** True when the effective deadline is strictly before "now". */
export function isProjectOverdue(p: ProjectDeadlineInput, nowMs: number = Date.now()): boolean {
  const deadline = getEffectiveDeadline(p);
  if (!deadline) return false;
  return deadline.getTime() < nowMs;
}

/**
 * Whole days remaining until the effective deadline. Clamped at zero —
 * an overdue project gets `0`, never a negative number, so the UI can
 * just render this value without a sign check.
 */
export function daysRemainingForProject(
  p: ProjectDeadlineInput,
  nowMs: number = Date.now(),
): number {
  const deadline = getEffectiveDeadline(p);
  if (!deadline) return 0;
  const diff = deadline.getTime() - nowMs;
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

/**
 * Feature flags for the gradual security rollout (Maintenance Plan Phase 0).
 *
 * Each flag is read from a Vercel environment variable. Flags are
 * evaluated per request (via getter) so flipping a flag in Vercel's
 * dashboard takes effect on the next invocation.
 *
 * Naming: FF_<UPPER_SNAKE_CASE> on the env side, camelCase here.
 *
 * Default for every flag is `false` (shadow mode). Flags are flipped
 * to `true` only after their corresponding telemetry shows zero
 * legitimate violations for at least 7 consecutive days.
 */

function flag(name: string): boolean {
  return process.env[name] === "true";
}

export const flags = {
  /** Enforce strict Zod-validated patch bodies (M1 fix #1). */
  get enforceMassAssignment() { return flag("FF_ENFORCE_MASS_ASSIGN"); },

  /** Stop letting MANAGER role bypass the permissions table (M1 fix #2). */
  get enforceManagerPermissions() { return flag("FF_ENFORCE_MANAGER_PERMS"); },

  /** Compute cashier totals from server-side service prices (M1 fix #3). */
  get enforceCashierServerPrice() { return flag("FF_ENFORCE_CASHIER_PRICE"); },

  /** Reject impersonation cookies that aren't signed JWTs (M1 fix #4). */
  get enforceImpersonationToken() { return flag("FF_ENFORCE_IMPERSONATION_TOKEN"); },

  /** Block /api/service-requests/upload (deprecated, M1 fix #5). */
  get blockDeprecatedUpload() { return flag("FF_BLOCK_DEPRECATED_UPLOAD"); },

  /** Enforce ownership/role checks on per-resource [id] routes (M2). */
  get enforceIdor() { return flag("FF_ENFORCE_IDOR"); },

  /** Enforce rate-limits instead of just logging hits (M2). */
  get enforceRateLimit() { return flag("FF_ENFORCE_RATE_LIMIT"); },

  /** Switch CSP from Report-Only to enforcing (M2). */
  get enforceCsp() { return flag("FF_ENFORCE_CSP"); },
} as const;

export type FeatureFlag = keyof typeof flags;

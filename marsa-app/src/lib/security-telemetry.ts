import { logger } from "./logger";
import { prisma } from "./prisma";

/**
 * Categorized list of security events emitted across the codebase.
 *
 * Convention:
 *   - `*_BLOCKED`     — the new code is in enforce mode and rejected
 *                       the request. Severity: ERROR.
 *   - `*_WOULD_BLOCK` — the new code is in shadow mode; the request
 *                       went through, but we recorded what would have
 *                       been rejected. Severity: WARNING.
 *   - `*_USED` / `*_HIT` — informational; a sensitive code path was
 *                          exercised. Severity: WARNING.
 */
export type SecurityEvent =
  | "MASS_ASSIGNMENT_BLOCKED"
  | "MASS_ASSIGNMENT_WOULD_BLOCK"
  | "IDOR_BLOCKED"
  | "IDOR_WOULD_BLOCK"
  | "MANAGER_BYPASS_USED"
  | "MANAGER_BYPASS_BLOCKED"
  | "CASHIER_PRICE_MISMATCH"
  | "ZOD_VALIDATION_FAILED"
  | "RATE_LIMIT_HIT"
  | "RATE_LIMIT_BLOCKED"
  | "DEPRECATED_UPLOAD_USED"
  | "IMPERSONATION_STARTED"
  | "IMPERSONATION_STOPPED"
  | "CSP_VIOLATION";

export interface SecurityEventMeta {
  userId?: string | null;
  userRole?: string | null;
  route?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  [key: string]: unknown;
}

/**
 * Record a security event. Writes to:
 *   1. Vercel logs (via logger.warn)
 *   2. The AuditLog table under module="SECURITY" so the admin
 *      monitor page can query it.
 *
 * Never throws — telemetry must never break the main flow.
 */
export async function recordSecurityEvent(
  event: SecurityEvent,
  meta: SecurityEventMeta = {}
): Promise<void> {
  // 1) Log first so the event shows up in Vercel runtime logs even
  //    if the DB write fails for any reason.
  logger.warn(`[SECURITY] ${event}`, meta);

  // 2) Persist to AuditLog. Wrapped in try/catch — telemetry failures
  //    must never bubble into the request handler.
  try {
    const severity = event.endsWith("_BLOCKED")
      ? "ERROR"
      : event.endsWith("_WOULD_BLOCK") ||
        event.endsWith("_HIT") ||
        event.endsWith("_USED") ||
        event === "CSP_VIOLATION" ||
        event === "CASHIER_PRICE_MISMATCH" ||
        event === "ZOD_VALIDATION_FAILED"
      ? "WARNING"
      : "INFO";

    await prisma.auditLog.create({
      data: {
        action: event,
        module: "SECURITY",
        severity,
        userId: meta.userId ?? null,
        userRole: meta.userRole ?? null,
        ipAddress: meta.ipAddress ?? null,
        meta: meta as never,
      },
    });
  } catch (error) {
    logger.error("Failed to write security event to AuditLog", error, {
      event,
    });
  }
}

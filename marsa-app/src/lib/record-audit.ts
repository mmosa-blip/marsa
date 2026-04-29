import { prisma } from "@/lib/prisma";

/**
 * Append a single entry to a record-item's audit trail. Failure is
 * swallowed: an audit-log write must never block or roll back the
 * caller. The schema-level cascade (`onDelete: Cascade`) guarantees
 * orphan rows can't outlive their parent, so we don't fight DB integrity
 * inside the application layer either.
 *
 * Action strings are free-form by design — the schema comment lists the
 * canonical set (CREATED / UPDATED / DELETED / RESTORED / APPROVED /
 * REJECTED / OBSOLETED / VIEWED_CREDENTIALS / PLATFORM_OPENED /
 * ISSUE_ACKNOWLEDGED / ISSUE_RESOLVED / SHARED_WITH_CLIENT). Callers
 * should stick to these so search/aggregations work.
 */
export async function appendRecordAudit(args: {
  recordItemId: string;
  action: string;
  actorId?: string | null;
  before?: unknown;
  after?: unknown;
}): Promise<void> {
  try {
    await prisma.recordItemAuditLog.create({
      data: {
        recordItemId: args.recordItemId,
        action: args.action,
        actorId: args.actorId ?? null,
        beforeJson:
          args.before !== undefined ? JSON.stringify(args.before) : null,
        afterJson:
          args.after !== undefined ? JSON.stringify(args.after) : null,
      },
    });
  } catch (e) {
    console.error("appendRecordAudit failed", e);
  }
}

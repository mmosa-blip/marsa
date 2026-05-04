import { prisma } from "./prisma";

export type AuditAction =
  | "USER_LOGIN" | "USER_LOGOUT" | "LOGIN_FAILED"
  | "USER_CREATED" | "USER_UPDATED" | "USER_DELETED" | "USER_RESTORED"
  | "PERMISSION_GRANTED" | "PERMISSION_REVOKED" | "PERMISSIONS_UPDATED"
  | "CONTRACT_CREATED" | "CONTRACT_SUBMITTED" | "CONTRACT_APPROVED"
  | "CONTRACT_REJECTED" | "CONTRACT_SENT_TO_CLIENT" | "CONTRACT_SIGNED"
  | "CONTRACT_ACTIVATED" | "CONTRACT_CANCELLED" | "CONTRACT_EDITED"
  | "CONTRACT_REVISION_REQUESTED" | "CONTRACT_RENUMBERED"
  | "PROJECT_CREATED" | "PROJECT_UPDATED" | "PROJECT_DELETED"
  | "PROJECT_STATUS_CHANGED" | "PROJECT_RENUMBERED"
  | "PROJECT_CELEBRATION_DOWNLOADED"
  | "PROJECT_REACTIVATED"
  | "TASK_ASSIGNED" | "TASK_STARTED" | "TASK_COMPLETED" | "TASK_CANCELLED"
  | "TASK_TRANSFER_REQUESTED" | "TASK_TRANSFER_APPROVED" | "TASK_TRANSFER_REJECTED"
  | "INSTALLMENT_PAID" | "INSTALLMENT_PARTIAL" | "INSTALLMENT_APPROVED"
  | "INSTALLMENT_RECORDED" | "INSTALLMENT_CONFIRMED" | "INSTALLMENT_REJECTED"
  | "PAYMENT_RECORDED" | "PAYMENT_FOLLOWUP_LOGGED" | "PAYMENT_WAIVED"
  | "INSTALLMENTS_DEFINED" | "INSTALLMENTS_AUTO_CREATED"
  | "EXPENSE_REQUESTED" | "EXPENSE_APPROVED" | "EXPENSE_REJECTED"
  | "CASHIER_ENTRY_ADDED"
  | "TICKET_CREATED" | "TICKET_ASSIGNED" | "TICKET_STATUS_CHANGED"
  | "TICKET_RESOLVED" | "TICKET_CLOSED"
  | "CLIENT_CREATED" | "CLIENT_UPDATED" | "CLIENT_DELETED"
  | "SIGNATURE_UPDATED" | "STAMP_UPDATED" | "LETTERHEAD_UPDATED"
  | "INVOICE_DELETED"
  | "SETTINGS_UPDATED";

export const AuditModule = {
  AUTH: "auth",
  USERS: "users",
  CONTRACTS: "contracts",
  PROJECTS: "projects",
  TASKS: "tasks",
  FINANCE: "finance",
  TICKETS: "tickets",
  CLIENTS: "clients",
  SETTINGS: "settings",
} as const;

interface AuditOptions {
  userId?: string;
  userName?: string;
  userRole?: string;
  action: AuditAction;
  module: string;
  severity?: "INFO" | "WARN" | "CRITICAL";
  entityType?: string;
  entityId?: string;
  entityName?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  before?: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  after?: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  meta?: Record<string, any>;
  notes?: string;
  ipAddress?: string;
}

export async function createAuditLog(opts: AuditOptions) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: opts.userId,
        userName: opts.userName,
        userRole: opts.userRole,
        action: opts.action,
        module: opts.module,
        severity: opts.severity || "INFO",
        entityType: opts.entityType,
        entityId: opts.entityId,
        entityName: opts.entityName,
        before: opts.before || undefined,
        after: opts.after || undefined,
        meta: opts.meta || undefined,
        notes: opts.notes,
        ipAddress: opts.ipAddress,
      },
    });
  } catch (e) {
    console.error("Audit log failed:", e);
  }
}

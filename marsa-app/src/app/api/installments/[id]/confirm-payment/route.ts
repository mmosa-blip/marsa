import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { createNotifications } from "@/lib/notifications";
import { createAuditLog, AuditModule } from "@/lib/audit";
import { logger } from "@/lib/logger";

// POST /api/installments/[id]/confirm-payment
//
// Finance approver (ADMIN / MANAGER / FINANCE_MANAGER) acts on a
// `PENDING_CONFIRMATION` record produced by /record-payment:
//
//   action = "CONFIRM" → seal the receipt; nothing else changes.
//   action = "REJECT"  → revert this installment to UNPAID + isLocked=true
//                        and clear the paid fields. A non-empty
//                        `rejectionReason` is required. The previously
//                        unlocked next-in-order installment is intentionally
//                        left as-is (an executor may already be working on
//                        its task; a separate `lock` action can re-lock if
//                        the policy ever tightens).
//
// Body: { action: "CONFIRM" | "REJECT", rejectionReason?: string }
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRole(["ADMIN", "MANAGER", "FINANCE_MANAGER"]);
    const userId = session.user.id;
    const role = session.user.role;
    const { id } = await params;

    const body = await req.json().catch(() => ({}));
    const action = body?.action;
    if (action !== "CONFIRM" && action !== "REJECT") {
      return NextResponse.json(
        { error: "action يجب أن يكون CONFIRM أو REJECT" },
        { status: 400 }
      );
    }

    const rejectionReason =
      typeof body?.rejectionReason === "string" ? body.rejectionReason.trim() : "";
    if (action === "REJECT" && rejectionReason.length === 0) {
      return NextResponse.json(
        { error: "سبب الرفض مطلوب" },
        { status: 400 }
      );
    }

    const inst = await prisma.contractPaymentInstallment.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        amount: true,
        paidAmount: true,
        confirmationStatus: true,
        recordedById: true,
        linkedTask: {
          select: {
            id: true,
            assigneeId: true,
            project: { select: { id: true } },
          },
        },
      },
    });
    if (!inst) {
      return NextResponse.json({ error: "الدفعة غير موجودة" }, { status: 404 });
    }

    if (inst.confirmationStatus !== "PENDING_CONFIRMATION") {
      return NextResponse.json(
        { error: "هذه الدفعة ليست بانتظار التأكيد" },
        { status: 409 }
      );
    }

    const now = new Date();

    const updated = await prisma.contractPaymentInstallment.update({
      where: { id },
      data:
        action === "CONFIRM"
          ? {
              confirmationStatus: "CONFIRMED",
              confirmedById: userId,
              confirmedAt: now,
              rejectionReason: null,
            }
          : {
              confirmationStatus: "REJECTED",
              confirmedById: userId,
              confirmedAt: now,
              rejectionReason,
              paymentStatus: "UNPAID",
              paidAmount: 0,
              paidAt: null,
              isLocked: true,
            },
    });

    // Notify the recorder and (if different) the linked task assignee.
    const recipientIds = [
      ...new Set(
        [inst.recordedById, inst.linkedTask?.assigneeId].filter(
          (uid): uid is string => !!uid && uid !== userId
        )
      ),
    ];
    const projectId = inst.linkedTask?.project?.id;
    const link = projectId ? `/dashboard/projects/${projectId}` : "/dashboard";
    const message =
      action === "CONFIRM"
        ? `تم تأكيد استلام دفعة "${inst.title}"`
        : `تم رفض تسجيل استلام دفعة "${inst.title}" — السبب: ${rejectionReason}`;
    if (recipientIds.length > 0) {
      await createNotifications(
        recipientIds.map((uid) => ({
          userId: uid,
          type: "PAYMENT_REQUEST_UPDATE" as const,
          message,
          link,
        }))
      );
    }

    await createAuditLog({
      userId,
      userName: session.user.name ?? undefined,
      userRole: role,
      action: action === "CONFIRM" ? "INSTALLMENT_CONFIRMED" : "INSTALLMENT_REJECTED",
      module: AuditModule.FINANCE,
      severity: action === "REJECT" ? "CRITICAL" : "WARN",
      entityType: "ContractPaymentInstallment",
      entityId: inst.id,
      entityName: inst.title,
      before: {
        confirmationStatus: "PENDING_CONFIRMATION",
        paidAmount: inst.paidAmount,
        paymentStatus: "PAID",
      },
      after:
        action === "CONFIRM"
          ? { confirmationStatus: "CONFIRMED" }
          : {
              confirmationStatus: "REJECTED",
              paymentStatus: "UNPAID",
              isLocked: true,
              rejectionReason,
            },
    });

    return NextResponse.json(updated);
  } catch (e) {
    if (e instanceof Response) return e;
    logger.error("installment confirm-payment error", e);
    return NextResponse.json({ error: "فشل تنفيذ الإجراء" }, { status: 500 });
  }
}

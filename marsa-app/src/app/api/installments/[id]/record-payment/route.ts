import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { createNotifications } from "@/lib/notifications";
import { createAuditLog, AuditModule } from "@/lib/audit";
import { logger } from "@/lib/logger";

// POST /api/installments/[id]/record-payment
//
// EXECUTOR (assignee of the linked task), MANAGER, or ADMIN can record
// that a client paid an installment. The installment unlocks immediately
// — its linked task becomes runnable and the next installment in order
// also opens up — but the row stays in `confirmationStatus =
// PENDING_CONFIRMATION` until a finance approver confirms or rejects via
// /confirm-payment. A REJECT re-locks both the installment and the
// linked task (handled in confirm-payment).
//
// Body (optional): { amount?: number } — defaults to the installment's
// full amount. Larger than the installment is rejected with 400.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const userId = session.user.id;
    const role = session.user.role;
    const { id } = await params;

    const inst = await prisma.contractPaymentInstallment.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        amount: true,
        order: true,
        contractId: true,
        paymentStatus: true,
        confirmationStatus: true,
        linkedTaskId: true,
        linkedTask: {
          select: {
            id: true,
            assigneeId: true,
            title: true,
            project: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!inst) {
      return NextResponse.json({ error: "الدفعة غير موجودة" }, { status: 404 });
    }

    const isAdminOrManager = role === "ADMIN" || role === "MANAGER";
    const isAssignedExecutor =
      role === "EXECUTOR" &&
      !!inst.linkedTask?.assigneeId &&
      inst.linkedTask.assigneeId === userId;
    if (!isAdminOrManager && !isAssignedExecutor) {
      return NextResponse.json({ error: "غير مصرح بتسجيل الاستلام" }, { status: 403 });
    }

    if (inst.confirmationStatus === "PENDING_CONFIRMATION") {
      return NextResponse.json(
        { error: "هذه الدفعة بانتظار التأكيد بالفعل" },
        { status: 409 }
      );
    }
    if (inst.confirmationStatus === "CONFIRMED") {
      return NextResponse.json({ error: "هذه الدفعة مؤكدة مسبقاً" }, { status: 409 });
    }
    if (inst.paymentStatus === "PAID" && inst.confirmationStatus !== "REJECTED") {
      return NextResponse.json({ error: "هذه الدفعة مدفوعة مسبقاً" }, { status: 409 });
    }

    const body = await req.json().catch(() => ({}));
    const requestedAmount = Number(body?.amount);
    const paidAmount =
      Number.isFinite(requestedAmount) && requestedAmount > 0
        ? requestedAmount
        : inst.amount;

    if (paidAmount > inst.amount) {
      return NextResponse.json(
        { error: "المبلغ المسجَّل أكبر من قيمة الدفعة" },
        { status: 400 }
      );
    }

    const now = new Date();

    const { updated, nextUnlockedId } = await prisma.$transaction(async (tx) => {
      const updated = await tx.contractPaymentInstallment.update({
        where: { id },
        data: {
          paidAmount,
          paymentStatus: "PAID",
          paidAt: now,
          isLocked: false,
          recordedById: userId,
          recordedAt: now,
          confirmationStatus: "PENDING_CONFIRMATION",
          rejectionReason: null,
          confirmedById: null,
          confirmedAt: null,
        },
      });

      const next = await tx.contractPaymentInstallment.findFirst({
        where: { contractId: inst.contractId, order: inst.order + 1 },
        select: { id: true, isLocked: true },
      });
      let nextUnlockedId: string | null = null;
      if (next?.isLocked) {
        await tx.contractPaymentInstallment.update({
          where: { id: next.id },
          data: { isLocked: false },
        });
        nextUnlockedId = next.id;
      }

      return { updated, nextUnlockedId };
    });

    // Notify finance approvers — anyone who can confirm payment.
    const approvers = await prisma.user.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        OR: [
          { role: { in: ["ADMIN", "MANAGER", "FINANCE_MANAGER"] } },
          {
            permissions: {
              some: {
                permission: { key: "finance.installments" },
                OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
              },
            },
          },
        ],
      },
      select: { id: true },
    });
    const recipientIds = [...new Set(approvers.map((u) => u.id))].filter(
      (uid) => uid !== userId
    );
    const projectId = inst.linkedTask?.project?.id;
    const recorderName = session.user.name ?? "";
    if (recipientIds.length > 0) {
      await createNotifications(
        recipientIds.map((uid) => ({
          userId: uid,
          type: "PAYMENT_REQUEST_UPDATE" as const,
          message: `تم تسجيل استلام دفعة "${inst.title}" بانتظار التأكيد${recorderName ? ` (${recorderName})` : ""}`,
          link: projectId ? `/dashboard/projects/${projectId}` : "/dashboard",
        }))
      );
    }

    await createAuditLog({
      userId,
      userName: session.user.name ?? undefined,
      userRole: role,
      action: "INSTALLMENT_RECORDED",
      module: AuditModule.FINANCE,
      severity: "WARN",
      entityType: "ContractPaymentInstallment",
      entityId: inst.id,
      entityName: inst.title,
      after: {
        paidAmount,
        paymentStatus: "PAID",
        confirmationStatus: "PENDING_CONFIRMATION",
        nextInstallmentUnlockedId: nextUnlockedId,
      },
    });

    return NextResponse.json({ ...updated, nextInstallmentUnlockedId: nextUnlockedId });
  } catch (e) {
    if (e instanceof Response) return e;
    logger.error("installment record-payment error", e);
    return NextResponse.json({ error: "فشل تسجيل الاستلام" }, { status: 500 });
  }
}

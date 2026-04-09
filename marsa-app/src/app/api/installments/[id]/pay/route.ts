import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createNotifications } from "@/lib/notifications";

// POST /api/installments/[id]/pay
// body: { amount }
// Full-payment confirmation. Admin/manager only — executors get a 403
// with a hint that the admin needs to approve (they should use
// /partial-request instead). Stamps paidAmount, paymentStatus=PAID,
// paidAt, unlocks the linked task, and pings the assignee via Pusher.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    // Executor path is blocked — full payment confirmation must go
    // through an admin/manager.
    if (session.user.role === "EXECUTOR") {
      return NextResponse.json(
        { error: "يجب موافقة الإدارة على تأكيد السداد الكامل" },
        { status: 403 }
      );
    }

    if (!["ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const amount = Number(body?.amount);

    const inst = await prisma.contractPaymentInstallment.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        amount: true,
        linkedTask: {
          select: {
            id: true,
            assigneeId: true,
            project: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!inst) {
      return NextResponse.json({ error: "الدفعة غير موجودة" }, { status: 404 });
    }

    // Default to the full installment amount when the caller omits it.
    const paidAmount = Number.isFinite(amount) && amount > 0 ? amount : inst.amount;

    const updated = await prisma.contractPaymentInstallment.update({
      where: { id },
      data: {
        paidAmount,
        paymentStatus: "PAID",
        paidAt: new Date(),
        isLocked: false,
        partialPaymentRequest: null,
      },
    });

    // Notify the executor whose task was blocked so they know the lock
    // is gone and they can start immediately.
    if (inst.linkedTask?.assigneeId) {
      await createNotifications([
        {
          userId: inst.linkedTask.assigneeId,
          type: "PAYMENT_REQUEST_UPDATE" as const,
          message: `تم تأكيد سداد "${inst.title}" — المهمة متاحة الآن`,
          link: inst.linkedTask.project?.id
            ? `/dashboard/projects/${inst.linkedTask.project.id}`
            : "/dashboard",
        },
      ]);
    }

    return NextResponse.json(updated);
  } catch (e) {
    console.error("installment pay error:", e);
    return NextResponse.json({ error: "فشل تأكيد السداد" }, { status: 500 });
  }
}

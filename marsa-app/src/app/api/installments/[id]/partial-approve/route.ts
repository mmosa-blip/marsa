import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createNotifications } from "@/lib/notifications";
import { requireRole } from "@/lib/api-auth";

// POST /api/installments/[id]/partial-approve
// Admin/manager approves the amount the executor requested in
// partial-request. Adds the amount to paidAmount; unlocks the linked
// task when the full installment amount has been covered.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRole(["ADMIN", "MANAGER"]);

    const { id } = await params;
    const inst = await prisma.contractPaymentInstallment.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        amount: true,
        paidAmount: true,
        partialPaymentRequest: true,
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
    if (inst.partialPaymentRequest == null || inst.partialPaymentRequest <= 0) {
      return NextResponse.json(
        { error: "لا يوجد طلب دفع جزئي معلّق على هذه الدفعة" },
        { status: 400 }
      );
    }

    const nextPaid = inst.paidAmount + inst.partialPaymentRequest;
    const fullyPaid = nextPaid >= inst.amount;

    const updated = await prisma.contractPaymentInstallment.update({
      where: { id },
      data: {
        paidAmount: nextPaid,
        partialPaymentRequest: null,
        partialApprovedById: session.user.id,
        partialApprovedAt: new Date(),
        ...(fullyPaid
          ? {
              isLocked: false,
              paymentStatus: "PAID",
              paidAt: new Date(),
            }
          : { paymentStatus: "PARTIAL" }),
      },
    });

    // Ping the executor whose task was blocked.
    if (inst.linkedTask?.assigneeId) {
      await createNotifications([
        {
          userId: inst.linkedTask.assigneeId,
          type: "PAYMENT_REQUEST_UPDATE" as const,
          message: fullyPaid
            ? `تمت الموافقة على الدفعة "${inst.title}" — المهمة متاحة الآن`
            : `تمت الموافقة على دفع جزئي من "${inst.title}"`,
          link: inst.linkedTask.project?.id
            ? `/dashboard/projects/${inst.linkedTask.project.id}`
            : "/dashboard",
        },
      ]);
    }

    return NextResponse.json(updated);
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("partial-approve error:", e);
    return NextResponse.json({ error: "فشل الموافقة" }, { status: 500 });
  }
}

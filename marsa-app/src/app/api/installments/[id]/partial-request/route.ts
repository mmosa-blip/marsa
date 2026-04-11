import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createNotifications } from "@/lib/notifications";

// POST /api/installments/[id]/partial-request
// body: { amount }
// Executor asks admin to accept a partial payment so they can unlock
// their blocked task early.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const amount = Number(body?.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "المبلغ الجزئي يجب أن يكون رقماً موجباً" },
        { status: 400 }
      );
    }

    const installment = await prisma.contractPaymentInstallment.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        amount: true,
        paidAmount: true,
        linkedTask: {
          select: {
            id: true,
            title: true,
            assigneeId: true,
            project: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!installment) {
      return NextResponse.json({ error: "الدفعة غير موجودة" }, { status: 404 });
    }

    // Executors may only request on their own blocked tasks; admin/manager
    // bypass the assignee check.
    const isStaff = ["ADMIN", "MANAGER"].includes(session.user.role);
    if (!isStaff) {
      if (installment.linkedTask?.assigneeId !== session.user.id) {
        return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
      }
    }

    if (amount + installment.paidAmount > installment.amount) {
      return NextResponse.json(
        { error: "المبلغ المطلوب يتجاوز المتبقي على الدفعة" },
        { status: 400 }
      );
    }

    const paymentType = body?.type === "FULL" ? "FULL" : "PARTIAL";

    const updated = await prisma.contractPaymentInstallment.update({
      where: { id },
      data: { partialPaymentRequest: amount, partialPaymentType: paymentType },
    });

    // Notify every ADMIN so someone can approve.
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN", isActive: true, deletedAt: null },
      select: { id: true },
    });
    if (admins.length > 0) {
      await createNotifications(
        admins.map((a) => ({
          userId: a.id,
          type: "PAYMENT_REQUEST_UPDATE" as const,
          message: `${paymentType === "FULL" ? "تأكيد سداد كامل" : "طلب دفع جزئي"} (${amount.toLocaleString("en-US")}) على دفعة "${installment.title}"${
            installment.linkedTask?.project?.name
              ? ` — مشروع ${installment.linkedTask.project.name}`
              : ""
          }`,
          link: installment.linkedTask?.project?.id
            ? `/dashboard/projects/${installment.linkedTask.project.id}`
            : "/dashboard/finance",
        }))
      );
    }

    return NextResponse.json(updated);
  } catch (e) {
    console.error("partial-request error:", e);
    return NextResponse.json({ error: "فشل إرسال الطلب" }, { status: 500 });
  }
}

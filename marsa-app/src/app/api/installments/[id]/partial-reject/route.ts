import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createNotifications } from "@/lib/notifications";

// POST /api/installments/[id]/partial-reject
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const { id } = await params;
    const inst = await prisma.contractPaymentInstallment.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        linkedTask: {
          select: {
            assigneeId: true,
            project: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!inst) {
      return NextResponse.json({ error: "الدفعة غير موجودة" }, { status: 404 });
    }

    await prisma.contractPaymentInstallment.update({
      where: { id },
      data: { partialPaymentRequest: null, partialPaymentType: null },
    });

    if (inst.linkedTask?.assigneeId) {
      await createNotifications([{
        userId: inst.linkedTask.assigneeId,
        type: "PAYMENT_REQUEST_UPDATE" as const,
        message: `تم رفض طلب الدفع على "${inst.title}"`,
        link: inst.linkedTask.project?.id
          ? `/dashboard/projects/${inst.linkedTask.project.id}`
          : "/dashboard",
      }]);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("partial-reject error:", e);
    return NextResponse.json({ error: "فشل الرفض" }, { status: 500 });
  }
}

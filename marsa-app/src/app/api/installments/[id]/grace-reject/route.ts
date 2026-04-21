import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createNotifications } from "@/lib/notifications";
import { requireRole } from "@/lib/api-auth";

// POST /api/installments/[id]/grace-reject
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["ADMIN", "MANAGER"]);

    const { id } = await params;
    const inst = await prisma.contractPaymentInstallment.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        gracePeriodDays: true,
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
      data: { gracePeriodDays: null, gracePeriodApproved: false, gracePeriodEnd: null },
    });

    if (inst.linkedTask?.assigneeId) {
      await createNotifications([{
        userId: inst.linkedTask.assigneeId,
        type: "PAYMENT_REQUEST_UPDATE" as const,
        message: `تم رفض طلب الإمهال على "${inst.title}"`,
        link: inst.linkedTask.project?.id
          ? `/dashboard/projects/${inst.linkedTask.project.id}`
          : "/dashboard",
      }]);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("grace-reject error:", e);
    return NextResponse.json({ error: "فشل الرفض" }, { status: 500 });
  }
}

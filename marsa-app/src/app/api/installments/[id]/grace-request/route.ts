import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createNotifications } from "@/lib/notifications";

// POST /api/installments/[id]/grace-request
// body: { days }
// Executor requests a temporary grace period (1-30 days) during which
// the task is unlocked even though the installment is still unpaid.
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
    const body = await req.json().catch(() => ({}));
    const days = Number(body?.days);
    if (!Number.isFinite(days) || days < 1 || days > 30) {
      return NextResponse.json(
        { error: "عدد الأيام يجب أن يكون بين 1 و 30" },
        { status: 400 }
      );
    }

    const inst = await prisma.contractPaymentInstallment.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
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

    // Permission: executor assigned to the task, or admin/manager.
    const isStaff = ["ADMIN", "MANAGER"].includes(session.user.role);
    if (!isStaff && inst.linkedTask?.assigneeId !== session.user.id) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const updated = await prisma.contractPaymentInstallment.update({
      where: { id },
      data: {
        gracePeriodDays: days,
        gracePeriodApproved: false,
        gracePeriodEnd: null,
      },
    });

    // Notify admins for approval.
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN", isActive: true, deletedAt: null },
      select: { id: true },
    });
    if (admins.length > 0) {
      await createNotifications(
        admins.map((a) => ({
          userId: a.id,
          type: "PAYMENT_REQUEST_UPDATE" as const,
          message: `طلب إمهال ${days} يوم على دفعة "${inst.title}"${
            inst.linkedTask?.project?.name
              ? ` — مشروع ${inst.linkedTask.project.name}`
              : ""
          }`,
          link: inst.linkedTask?.project?.id
            ? `/dashboard/projects/${inst.linkedTask.project.id}`
            : "/dashboard/finance",
        }))
      );
    }

    return NextResponse.json(updated);
  } catch (e) {
    console.error("grace-request error:", e);
    return NextResponse.json({ error: "فشل إرسال طلب الإمهال" }, { status: 500 });
  }
}

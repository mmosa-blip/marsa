import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createNotifications } from "@/lib/notifications";

// POST /api/installments/[id]/grace-approve
// Admin/manager approves the grace-period request. Computes the end
// date (now + gracePeriodDays calendar days) and temporarily unlocks
// the linked task. computeCanStart in /api/my-tasks/all re-locks it
// automatically once the end date passes.
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
        gracePeriodDays: true,
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
    if (!inst.gracePeriodDays || inst.gracePeriodDays <= 0) {
      return NextResponse.json(
        { error: "لا يوجد طلب إمهال معلّق على هذه الدفعة" },
        { status: 400 }
      );
    }

    const MS_PER_DAY = 86_400_000;
    const endDate = new Date(Date.now() + inst.gracePeriodDays * MS_PER_DAY);

    const updated = await prisma.contractPaymentInstallment.update({
      where: { id },
      data: {
        gracePeriodEnd: endDate,
        gracePeriodApproved: true,
        // Temporarily unlock — computeCanStart checks gracePeriodEnd
        // and will re-lock once the date expires.
        isLocked: false,
      },
    });

    // Notify the executor.
    if (inst.linkedTask?.assigneeId) {
      await createNotifications([
        {
          userId: inst.linkedTask.assigneeId,
          type: "PAYMENT_REQUEST_UPDATE" as const,
          message: `تمت الموافقة على إمهال ${inst.gracePeriodDays} يوم — المهمة متاحة مؤقتاً حتى ${endDate.toLocaleDateString("ar-SA-u-nu-latn")}`,
          link: inst.linkedTask.project?.id
            ? `/dashboard/projects/${inst.linkedTask.project.id}`
            : "/dashboard",
        },
      ]);
    }

    return NextResponse.json(updated);
  } catch (e) {
    console.error("grace-approve error:", e);
    return NextResponse.json({ error: "فشل الموافقة" }, { status: 500 });
  }
}

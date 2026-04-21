import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createNotifications } from "@/lib/notifications";
import { addWorkingDays } from "@/lib/working-days";
import { requireAuth } from "@/lib/api-auth";

// POST /api/tasks/[id]/grace-request
// body: { days, reason }
// Executor requests a grace period (1-30 working days) for an overdue task.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const days = Number(body?.days);
    const reason = String(body?.reason ?? "").trim();

    if (!Number.isFinite(days) || days < 1 || days > 30) {
      return NextResponse.json(
        { error: "عدد الأيام يجب أن يكون بين 1 و 30" },
        { status: 400 }
      );
    }
    if (!reason) {
      return NextResponse.json(
        { error: "يجب تقديم سبب لطلب الإمهال" },
        { status: 400 }
      );
    }

    const task = await prisma.task.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        dueDate: true,
        assigneeId: true,
        project: { select: { id: true, name: true } },
      },
    });
    if (!task) {
      return NextResponse.json({ error: "المهمة غير موجودة" }, { status: 404 });
    }

    // Permission: the assigned executor, or admin/manager.
    const isStaff = ["ADMIN", "MANAGER"].includes(session.user.role);
    if (!isStaff && task.assigneeId !== session.user.id) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    // Extend dueDate by the requested working days.
    const newDueDate = task.dueDate
      ? addWorkingDays(task.dueDate, days)
      : undefined;

    const updated = await prisma.task.update({
      where: { id },
      data: {
        taskGraceDays: days,
        taskGraceReason: reason,
        taskGraceApproved: false,
        taskGraceEnd: null,
        ...(newDueDate ? { dueDate: newDueDate } : {}),
      },
    });

    // Notify all admins for approval.
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN", isActive: true, deletedAt: null },
      select: { id: true },
    });
    if (admins.length > 0) {
      await createNotifications(
        admins.map((a) => ({
          userId: a.id,
          type: "TASK_UPDATE" as const,
          message: `طلب إمهال ${days} يوم على مهمة "${task.title}"${
            task.project?.name
              ? ` — مشروع ${task.project.name}`
              : ""
          }`,
          link: task.project?.id
            ? `/dashboard/projects/${task.project.id}`
            : "/dashboard",
        }))
      );
    }

    return NextResponse.json(updated);
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("task grace-request error:", e);
    return NextResponse.json(
      { error: "فشل إرسال طلب الإمهال" },
      { status: 500 }
    );
  }
}

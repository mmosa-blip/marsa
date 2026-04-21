import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createNotifications } from "@/lib/notifications";
import { addWorkingDays } from "@/lib/working-days";
import { requireRole } from "@/lib/api-auth";

// POST /api/tasks/[id]/grace-reject
// ADMIN/MANAGER rejects a pending grace-period request on a task.
// Reverts the dueDate by subtracting the previously added days.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["ADMIN", "MANAGER"]);

    const { id } = await params;

    const task = await prisma.task.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        dueDate: true,
        taskGraceDays: true,
        taskGraceApproved: true,
        assigneeId: true,
        project: { select: { id: true, name: true } },
      },
    });
    if (!task) {
      return NextResponse.json({ error: "المهمة غير موجودة" }, { status: 404 });
    }
    if (!task.taskGraceDays) {
      return NextResponse.json(
        { error: "لا يوجد طلب إمهال على هذه المهمة" },
        { status: 400 }
      );
    }

    // Revert the dueDate by subtracting the days that were added.
    // addWorkingDays with negative days effectively subtracts.
    const revertedDueDate = task.dueDate
      ? addWorkingDays(task.dueDate, -task.taskGraceDays)
      : undefined;

    const updated = await prisma.task.update({
      where: { id },
      data: {
        taskGraceDays: null,
        taskGraceReason: null,
        taskGraceApproved: false,
        taskGraceEnd: null,
        ...(revertedDueDate ? { dueDate: revertedDueDate } : {}),
      },
    });

    // Notify the task assignee.
    if (task.assigneeId) {
      await createNotifications([
        {
          userId: task.assigneeId,
          type: "TASK_UPDATE" as const,
          message: `تم رفض طلب الإمهال على مهمة "${task.title}"${
            task.project?.name
              ? ` — مشروع ${task.project.name}`
              : ""
          }`,
          link: task.project?.id
            ? `/dashboard/projects/${task.project.id}`
            : "/dashboard",
        },
      ]);
    }

    return NextResponse.json(updated);
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("task grace-reject error:", e);
    return NextResponse.json(
      { error: "فشل رفض طلب الإمهال" },
      { status: 500 }
    );
  }
}

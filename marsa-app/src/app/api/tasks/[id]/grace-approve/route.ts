import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createNotifications } from "@/lib/notifications";
import { addWorkingDays } from "@/lib/working-days";
import { requireRole } from "@/lib/api-auth";

// POST /api/tasks/[id]/grace-approve
// ADMIN/MANAGER approves a pending grace-period request on a task.
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
    if (task.taskGraceApproved) {
      return NextResponse.json(
        { error: "طلب الإمهال مقبول مسبقاً" },
        { status: 400 }
      );
    }

    const graceEnd = addWorkingDays(new Date(), task.taskGraceDays);

    const updated = await prisma.task.update({
      where: { id },
      data: {
        taskGraceApproved: true,
        taskGraceEnd: graceEnd,
      },
    });

    // Notify the task assignee.
    if (task.assigneeId) {
      await createNotifications([
        {
          userId: task.assigneeId,
          type: "TASK_UPDATE" as const,
          message: `تمت الموافقة على طلب الإمهال على مهمة "${task.title}"${
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
    console.error("task grace-approve error:", e);
    return NextResponse.json(
      { error: "فشل قبول طلب الإمهال" },
      { status: 500 }
    );
  }
}

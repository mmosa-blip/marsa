import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createNotifications } from "@/lib/notifications";

// POST /api/tasks/[id]/revert
// body: { reason }
// Reverts a DONE task back to IN_PROGRESS.
// ADMIN/MANAGER can revert any task; EXECUTOR can revert their own.
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
    const reason = String(body?.reason ?? "").trim();

    if (!reason) {
      return NextResponse.json(
        { error: "يجب تقديم سبب لإرجاع المهمة" },
        { status: 400 }
      );
    }

    const task = await prisma.task.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        status: true,
        assigneeId: true,
        project: { select: { id: true, name: true } },
      },
    });
    if (!task) {
      return NextResponse.json({ error: "المهمة غير موجودة" }, { status: 404 });
    }

    if (task.status !== "DONE") {
      return NextResponse.json(
        { error: "يمكن إرجاع المهام المكتملة فقط" },
        { status: 400 }
      );
    }

    // Permission: ADMIN/MANAGER or the assigned executor.
    const isStaff = ["ADMIN", "MANAGER"].includes(session.user.role);
    if (!isStaff && task.assigneeId !== session.user.id) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const updated = await prisma.task.update({
      where: { id },
      data: {
        status: "IN_PROGRESS",
        revertedAt: new Date(),
        revertedById: session.user.id,
        revertReason: reason,
      },
    });

    // Notify the assignee if they are not the one reverting.
    if (task.assigneeId && task.assigneeId !== session.user.id) {
      await createNotifications([
        {
          userId: task.assigneeId,
          type: "TASK_UPDATE" as const,
          message: `تم إرجاع مهمة "${task.title}" إلى قيد التنفيذ${
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
    console.error("task revert error:", e);
    return NextResponse.json(
      { error: "فشل إرجاع المهمة" },
      { status: 500 }
    );
  }
}

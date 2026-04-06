import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { taskRejectionSchema } from "@/lib/validations";
import { reassignTask } from "@/lib/task-assignment";
import { createNotifications } from "@/lib/notifications";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    const parsed = taskRejectionSchema.safeParse(body);
    if (!parsed.success) {
      const errors = parsed.error.issues.map((e: { message: string }) => e.message).join(", ");
      return NextResponse.json({ error: errors }, { status: 400 });
    }
    const { reason } = parsed.data;

    const task = await prisma.task.findUnique({
      where: { id },
      select: { id: true, title: true, assigneeId: true, projectId: true },
    });

    if (!task) return NextResponse.json({ error: "المهمة غير موجودة" }, { status: 404 });

    if (task.assigneeId !== session.user.id) {
      return NextResponse.json(
        { error: "يمكن فقط للمنفذ المعيّن رفض المهمة" },
        { status: 403 }
      );
    }

    const provider = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true },
    });

    // Record rejection
    await prisma.taskRejection.create({
      data: { taskId: id, providerId: session.user.id, reason },
    });

    // Notify admins about the rejection
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN", isActive: true, deletedAt: null },
      select: { id: true },
    });
    if (admins.length > 0) {
      await createNotifications(
        admins.map((a) => ({
          userId: a.id,
          type: "TASK_REJECTED" as const,
          message: `رفض ${provider?.name || "المنفذ"} المهمة: ${task.title} — السبب: ${reason}`,
          link: `/dashboard/projects/${task.projectId}`,
        }))
      );
    }

    // Auto-reassign to next qualified executor (or notify admins if none left)
    const newAssignee = await reassignTask(id);

    return NextResponse.json({
      success: true,
      reassigned: !!newAssignee,
      newAssigneeId: newAssignee,
    });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

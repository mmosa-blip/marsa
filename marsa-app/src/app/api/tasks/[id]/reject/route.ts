import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createNotifications } from "@/lib/notifications";
import { taskRejectionSchema } from "@/lib/validations";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = taskRejectionSchema.safeParse(body);
    if (!parsed.success) {
      const errors = parsed.error.issues.map((e: { message: string }) => e.message).join(", ");
      return NextResponse.json({ error: errors }, { status: 400 });
    }
    const { reason } = parsed.data;

    // Fetch the task
    const task = await prisma.task.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!task) {
      return NextResponse.json({ error: "المهمة غير موجودة" }, { status: 404 });
    }

    // Verify the session user is the current assignee
    if (task.assigneeId !== session.user.id) {
      return NextResponse.json(
        { error: "يمكن فقط للمزود المعين رفض المهمة" },
        { status: 403 }
      );
    }

    // Get provider info for notification message
    const provider = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true },
    });

    // Create rejection record and unassign task
    await prisma.$transaction([
      prisma.taskRejection.create({
        data: {
          taskId: id,
          providerId: session.user.id,
          reason,
        },
      }),
      prisma.task.update({
        where: { id },
        data: { assigneeId: null },
      }),
    ]);

    // Notify all admins
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN", isActive: true },
      select: { id: true },
    });

    if (admins.length > 0) {
      await createNotifications(
        admins.map((admin) => ({
          userId: admin.id,
          type: "TASK_REJECTED" as const,
          message: `رفض المزود ${provider?.name} المهمة: ${task.title}`,
          link: "/dashboard/projects",
        }))
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

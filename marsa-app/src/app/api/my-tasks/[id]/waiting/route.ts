import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const { id } = await params;
    const { mode, providerId, governmentEntity } = await request.json();

    if (mode === null) {
      // Clear waiting mode — resume task
      await prisma.task.update({
        where: { id },
        data: { waitingMode: null, status: "IN_PROGRESS" },
      });
      return NextResponse.json({ ok: true });
    }

    await prisma.task.update({
      where: { id },
      data: { waitingMode: mode },
    });

    if (mode === "PROVIDER" && providerId) {
      // Remove old provider links first
      await prisma.taskExternalProvider.deleteMany({ where: { taskId: id } });
      await prisma.taskExternalProvider.create({
        data: {
          taskId: id,
          providerId,
          linkedById: session.user.id,
        },
      });

      // Link provider so they see the task in my-tasks
      await prisma.taskAssignment.upsert({
        where: { taskId_userId: { taskId: id, userId: providerId } },
        create: { taskId: id, userId: providerId },
        update: {},
      });

      // Notify the provider
      await prisma.notification.create({
        data: {
          userId: providerId,
          type: "NEW_TASK",
          message: "تم إسنادك كمزود خدمة خارجي لمهمة جديدة",
          link: "/dashboard/my-tasks",
        },
      }).catch(() => {});
    }

    if (mode === "GOVERNMENT") {
      // Deactivate old holds
      await prisma.taskGovernmentHold.updateMany({
        where: { taskId: id, isActive: true },
        data: { isActive: false },
      });
      await prisma.taskGovernmentHold.create({
        data: {
          taskId: id,
          heldById: session.user.id,
          entity: governmentEntity || null,
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error setting waiting mode:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

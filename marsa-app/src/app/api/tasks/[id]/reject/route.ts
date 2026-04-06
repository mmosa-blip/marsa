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
      select: { id: true, title: true, assigneeId: true, projectId: true, acceptedAt: true },
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

    // Reject only makes sense for tasks that are pending acceptance — i.e.
    // arrived via an admin-approved transfer. Auto-assigned tasks always
    // have acceptedAt set and cannot be rejected via this endpoint.
    if (task.acceptedAt) {
      return NextResponse.json(
        { error: "لا يمكن رفض مهمة مقبولة — استخدم تحويل المهمة بدلاً من ذلك" },
        { status: 400 }
      );
    }

    // Find the pending transfer that placed this task on the current user
    const pendingTransfer = await prisma.taskTransferRequest.findFirst({
      where: {
        taskId: id,
        targetUserId: session.user.id,
        status: "PENDING_TARGET",
      },
      orderBy: { createdAt: "desc" },
      include: { requester: { select: { id: true, name: true } } },
    });

    // Record the rejection on the task for audit/history
    await prisma.taskRejection.create({
      data: { taskId: id, providerId: session.user.id, reason },
    });

    // Notify admins
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN", isActive: true, deletedAt: null },
      select: { id: true },
    });
    if (admins.length > 0) {
      await createNotifications(
        admins.map((a) => ({
          userId: a.id,
          type: "TASK_REJECTED" as const,
          message: `رفض ${provider?.name || "المنفذ"} المهمة المحوّلة: ${task.title} — السبب: ${reason}`,
          link: `/dashboard/projects/${task.projectId}`,
        }))
      );
    }

    if (pendingTransfer) {
      // Revert: bounce the task back to the original requester (auto-accepted),
      // and mark the transfer as rejected by target.
      const now = new Date();
      await prisma.$transaction(async (tx) => {
        await tx.taskTransferRequest.update({
          where: { id: pendingTransfer.id },
          data: {
            status: "REJECTED_BY_TARGET",
            targetNote: reason,
            targetRespondedAt: now,
          },
        });
        await tx.task.update({
          where: { id },
          data: {
            assigneeId: pendingTransfer.requesterId,
            assignedAt: now,
            acceptedAt: now,
            status: "IN_PROGRESS",
          },
        });
        await tx.taskAssignment.upsert({
          where: { taskId_userId: { taskId: id, userId: pendingTransfer.requesterId } },
          create: { taskId: id, userId: pendingTransfer.requesterId },
          update: {},
        });
      });

      // Notify the original requester that the transfer was bounced back
      await createNotifications([
        {
          userId: pendingTransfer.requesterId,
          type: "TASK_TRANSFER_REJECTED" as const,
          message: `رفض ${provider?.name || "المنفذ المستهدف"} استلام المهمة "${task.title}" — أعيدت إليك`,
          link: "/dashboard/my-tasks",
        },
      ]);

      return NextResponse.json({ success: true, reverted: true });
    }

    // Fallback (shouldn't normally happen): no transfer record but acceptedAt
    // was null — kick the standard reassignment cycle.
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

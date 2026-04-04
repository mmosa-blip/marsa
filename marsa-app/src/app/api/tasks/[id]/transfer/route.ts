import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  createNotification,
  createNotifications,
} from "@/lib/notifications";
import { taskTransferSchema } from "@/lib/validations";

// POST — executor/provider submits a transfer request
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
    const parsed = taskTransferSchema.safeParse(body);
    if (!parsed.success) {
      const errors = parsed.error.issues.map((e: { message: string }) => e.message).join(", ");
      return NextResponse.json({ error: errors }, { status: 400 });
    }
    const { targetUserId, reason, urgency = "NORMAL" } = parsed.data;

    // Calculate expiresAt based on urgency
    const expiresAt = new Date();
    if (urgency === "URGENT") {
      expiresAt.setHours(expiresAt.getHours() + 1);
    } else {
      expiresAt.setHours(expiresAt.getHours() + 24);
    }

    const task = await prisma.task.findUnique({
      where: { id },
      include: { assignee: { select: { name: true } } },
    });

    if (!task) {
      return NextResponse.json({ error: "المهمة غير موجودة" }, { status: 404 });
    }

    // The assignee can always request a transfer
    // Admins/Managers can also request on behalf of anyone
    if (task.assigneeId !== session.user.id && !["ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "يمكن فقط للمنفذ المعين طلب تحويل المهمة" },
        { status: 403 }
      );
    }

    if (task.status === "DONE" || task.status === "CANCELLED") {
      return NextResponse.json(
        { error: "لا يمكن تحويل مهمة مكتملة أو ملغاة" },
        { status: 400 }
      );
    }

    // Validate target user is not a CLIENT
    const targetUser = await prisma.user.findUnique({ where: { id: targetUserId }, select: { id: true, name: true, role: true } });
    if (!targetUser || targetUser.role === "CLIENT") {
      return NextResponse.json({ error: "لا يمكن تحويل المهمة إلى عميل" }, { status: 400 });
    }

    // Check no active transfer exists
    const existing = await prisma.taskTransferRequest.findFirst({
      where: { taskId: id, status: { in: ["PENDING_ADMIN", "PENDING_TARGET"] } },
    });
    if (existing) {
      return NextResponse.json(
        { error: "يوجد طلب تحويل معلق لهذه المهمة بالفعل" },
        { status: 400 }
      );
    }

    // Check for permanent active delegation (auto-approve: skip all phases)
    const delegation = await prisma.taskTransferDelegation.findUnique({
      where: {
        fromProviderId_toProviderId: {
          fromProviderId: session.user.id,
          toProviderId: targetUserId,
        },
      },
    });

    const hasAutoDelegation = delegation && delegation.isPermanent && delegation.isActive;

    if (hasAutoDelegation) {
      const transferRequest = await prisma.$transaction(async (tx) => {
        const transfer = await tx.taskTransferRequest.create({
          data: {
            taskId: id,
            requesterId: session.user.id,
            targetUserId,
            reason,
            urgency,
            status: "APPROVED",
            reviewedAt: new Date(),
            targetRespondedAt: new Date(),
          },
          include: {
            task: true,
            requester: { select: { id: true, name: true } },
            targetUser: { select: { id: true, name: true } },
          },
        });

        await tx.task.update({
          where: { id },
          data: { assigneeId: targetUserId, assignedAt: new Date() },
        });

        return transfer;
      });

      await createNotification({
        userId: targetUserId,
        type: "NEW_TASK",
        message: `تم تحويل مهمة إليك: ${task.title}`,
        link: "/dashboard/my-tasks",
      });

      return NextResponse.json(transferRequest);
    }

    // Phase 1: create PENDING_ADMIN transfer request
    const requesterName = task.assignee?.name || session.user.name || "منفذ";

    const transferRequest = await prisma.taskTransferRequest.create({
      data: {
        taskId: id,
        requesterId: session.user.id,
        targetUserId,
        reason,
        urgency,
        expiresAt,
        status: "PENDING_ADMIN",
      },
      include: {
        task: true,
        requester: { select: { id: true, name: true } },
        targetUser: { select: { id: true, name: true } },
      },
    });

    // Notify admins and managers
    const admins = await prisma.user.findMany({
      where: { role: { in: ["ADMIN", "MANAGER"] }, isActive: true, deletedAt: null },
      select: { id: true },
    });

    if (admins.length > 0) {
      await createNotifications(
        admins.map((admin) => ({
          userId: admin.id,
          type: "TASK_TRANSFER_REQUEST" as const,
          message: `طلب تحويل مهمة من ${requesterName} إلى ${targetUser.name} — المهمة: ${task.title} — السبب: ${reason}`,
          link: "/dashboard/task-transfers",
        }))
      );
    }

    return NextResponse.json(transferRequest, { status: 201 });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

// GET — list transfer requests for a specific task
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const { id: taskId } = await params;

    const transfers = await prisma.taskTransferRequest.findMany({
      where: { taskId },
      include: {
        requester: { select: { id: true, name: true } },
        targetUser: { select: { id: true, name: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(transfers);
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createNotification, createNotifications } from "@/lib/notifications";
import { createAuditLog, AuditModule } from "@/lib/audit";

export async function PATCH(
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
    const { action, note, completeTask } = body;

    if (!action || !["approve", "reject", "accept", "decline", "cancel", "accept_complete"].includes(action)) {
      return NextResponse.json(
        { error: "الإجراء غير صالح" },
        { status: 400 }
      );
    }

    const transferRequest = await prisma.taskTransferRequest.findUnique({
      where: { id },
      include: {
        task: true,
        requester: { select: { id: true, name: true } },
        targetUser: { select: { id: true, name: true } },
      },
    });

    if (!transferRequest) {
      return NextResponse.json({ error: "طلب التحويل غير موجود" }, { status: 404 });
    }

    const now = new Date();

    // ============================================================
    // Phase 2: Admin approves/rejects (PENDING_ADMIN -> PENDING_TARGET / REJECTED_BY_ADMIN)
    // ============================================================
    if (action === "approve" || action === "reject") {
      if (!["ADMIN", "MANAGER"].includes(session.user.role)) {
        return NextResponse.json({ error: "غير مصرح — الإدارة فقط" }, { status: 403 });
      }

      if (transferRequest.status !== "PENDING_ADMIN") {
        return NextResponse.json({ error: "تم معالجة هذا الطلب مسبقاً" }, { status: 400 });
      }

      if (action === "approve") {
        // Reset expiresAt for target phase based on urgency
        const newExpiresAt = new Date();
        if (transferRequest.urgency === "URGENT") {
          newExpiresAt.setHours(newExpiresAt.getHours() + 1);
        } else {
          newExpiresAt.setHours(newExpiresAt.getHours() + 24);
        }

        const updated = await prisma.$transaction(async (tx) => {
          const transfer = await tx.taskTransferRequest.update({
            where: { id },
            data: {
              status: "PENDING_TARGET",
              reviewedById: session.user.id,
              reviewedAt: now,
              adminNote: note || null,
              expiresAt: newExpiresAt,
            },
            include: {
              task: true,
              requester: { select: { id: true, name: true } },
              targetUser: { select: { id: true, name: true } },
            },
          });

          // Move the task to the target executor in PENDING_ACCEPTANCE state.
          // (acceptedAt = null + assignedAt = now is the wire format for "needs
          // explicit acceptance" — only transferred tasks ever land here, since
          // auto-assigned tasks always set acceptedAt.)
          await tx.task.update({
            where: { id: transferRequest.taskId },
            data: {
              assigneeId: transferRequest.targetUserId,
              assignedAt: now,
              acceptedAt: null,
              status: "TODO",
              startedById: null,
            },
          });

          await tx.taskAssignment.upsert({
            where: { taskId_userId: { taskId: transferRequest.taskId, userId: transferRequest.targetUserId } },
            create: { taskId: transferRequest.taskId, userId: transferRequest.targetUserId },
            update: {},
          });

          return transfer;
        });

        // Notify target user
        await createNotification({
          userId: transferRequest.targetUserId,
          type: "TASK_TRANSFER_REQUEST",
          message: `تم تحويل مهمة "${transferRequest.task.title}" إليك من ${transferRequest.requester.name} — هل تقبل؟`,
          link: "/dashboard/task-transfers",
        });

        // Notify requester
        await createNotification({
          userId: transferRequest.requesterId,
          type: "TASK_TRANSFER_APPROVED",
          message: `تمت موافقة الإدارة على طلب التحويل، بانتظار موافقة ${transferRequest.targetUser.name}`,
          link: "/dashboard/task-transfers",
        });

        createAuditLog({
          userId: session.user.id, userName: session.user.name || undefined, userRole: session.user.role,
          action: "TASK_TRANSFER_APPROVED", module: AuditModule.TASKS,
          severity: "WARN",
          entityType: "TaskTransfer", entityId: id,
          entityName: transferRequest.task.title,
          notes: "موافقة الإدارة — بانتظار قبول المستهدف",
        });

        return NextResponse.json(updated);
      }

      // reject
      const updated = await prisma.taskTransferRequest.update({
        where: { id },
        data: {
          status: "REJECTED_BY_ADMIN",
          reviewedById: session.user.id,
          reviewedAt: now,
          adminNote: note || null,
        },
        include: {
          task: true,
          requester: { select: { id: true, name: true } },
          targetUser: { select: { id: true, name: true } },
        },
      });

      await createNotification({
        userId: transferRequest.requesterId,
        type: "TASK_TRANSFER_REJECTED",
        message: `تم رفض طلب التحويل من الإدارة — المهمة: ${transferRequest.task.title}${note ? ` — السبب: ${note}` : ""}`,
        link: "/dashboard/my-tasks",
      });

      createAuditLog({
        userId: session.user.id, userName: session.user.name || undefined, userRole: session.user.role,
        action: "TASK_TRANSFER_REJECTED", module: AuditModule.TASKS,
        entityType: "TaskTransfer", entityId: id,
        entityName: transferRequest.task.title,
        notes: note || undefined,
      });

      return NextResponse.json(updated);
    }

    // ============================================================
    // Phase 3: Target accepts/declines/accepts+completes (PENDING_TARGET -> APPROVED / REJECTED_BY_TARGET)
    // ============================================================
    if (action === "accept" || action === "decline" || action === "accept_complete") {
      if (session.user.id !== transferRequest.targetUserId) {
        return NextResponse.json({ error: "فقط المنفذ المستهدف يمكنه الرد على هذا الطلب" }, { status: 403 });
      }

      if (transferRequest.status !== "PENDING_TARGET") {
        return NextResponse.json({ error: "تم معالجة هذا الطلب مسبقاً" }, { status: 400 });
      }

      if (action === "accept" || action === "accept_complete") {
        const updated = await prisma.$transaction(async (tx) => {
          const transfer = await tx.taskTransferRequest.update({
            where: { id },
            data: {
              status: "APPROVED",
              targetNote: note || null,
              targetRespondedAt: now,
            },
            include: {
              task: true,
              requester: { select: { id: true, name: true } },
              targetUser: { select: { id: true, name: true } },
            },
          });

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const taskUpdate: any = {
            assigneeId: transferRequest.targetUserId,
            assignedAt: now,
            startedById: null,
          };

          // If accept_complete, also mark task as DONE
          if (action === "accept_complete") {
            taskUpdate.status = "DONE";
            taskUpdate.completedAt = now;
          }

          await tx.task.update({
            where: { id: transferRequest.taskId },
            data: taskUpdate,
          });

          // Ensure TaskAssignment exists
          await tx.taskAssignment.upsert({
            where: { taskId_userId: { taskId: transferRequest.taskId, userId: transferRequest.targetUserId } },
            create: { taskId: transferRequest.taskId, userId: transferRequest.targetUserId },
            update: {},
          });

          return transfer;
        });

        const completedMsg = action === "accept_complete"
          ? `قام ${transferRequest.targetUser.name} بقبول وإكمال المهمة "${transferRequest.task.title}" مباشرة`
          : `تم قبول التحويل — المهمة "${transferRequest.task.title}" انتقلت إلى ${transferRequest.targetUser.name}`;

        // Notify requester
        await createNotification({
          userId: transferRequest.requesterId,
          type: "TASK_TRANSFER_APPROVED",
          message: completedMsg,
          link: "/dashboard/my-tasks",
        });

        // Notify admins/managers
        const admins = await prisma.user.findMany({
          where: { role: { in: ["ADMIN", "MANAGER"] }, isActive: true, deletedAt: null },
          select: { id: true },
        });
        if (admins.length > 0) {
          await createNotifications(
            admins.map((a) => ({
              userId: a.id,
              type: "TASK_TRANSFER_APPROVED" as const,
              message: completedMsg,
              link: "/dashboard/task-transfers",
            }))
          );
        }

        createAuditLog({
          userId: session.user.id, userName: session.user.name || undefined, userRole: session.user.role,
          action: "TASK_TRANSFER_APPROVED", module: AuditModule.TASKS,
          entityType: "TaskTransfer", entityId: id,
          entityName: transferRequest.task.title,
          after: { from: transferRequest.requester.name, to: transferRequest.targetUser.name },
          notes: action === "accept_complete" ? "قبول وإكمال مباشر" : undefined,
        });

        return NextResponse.json(updated);
      }

      // decline
      const updated = await prisma.taskTransferRequest.update({
        where: { id },
        data: {
          status: "REJECTED_BY_TARGET",
          targetNote: note || null,
          targetRespondedAt: now,
        },
        include: {
          task: true,
          requester: { select: { id: true, name: true } },
          targetUser: { select: { id: true, name: true } },
        },
      });

      const declineMsg = `رفض ${transferRequest.targetUser.name} استلام المهمة "${transferRequest.task.title}"${note ? ` — السبب: ${note}` : ""}`;

      // Notify requester
      await createNotification({
        userId: transferRequest.requesterId,
        type: "TASK_TRANSFER_REJECTED",
        message: declineMsg,
        link: "/dashboard/my-tasks",
      });

      // Notify admins/managers
      const admins = await prisma.user.findMany({
        where: { role: { in: ["ADMIN", "MANAGER"] }, isActive: true, deletedAt: null },
        select: { id: true },
      });
      if (admins.length > 0) {
        await createNotifications(
          admins.map((a) => ({
            userId: a.id,
            type: "TASK_TRANSFER_REJECTED" as const,
            message: declineMsg,
            link: "/dashboard/task-transfers",
          }))
        );
      }

      createAuditLog({
        userId: session.user.id, userName: session.user.name || undefined, userRole: session.user.role,
        action: "TASK_TRANSFER_REJECTED", module: AuditModule.TASKS,
        entityType: "TaskTransfer", entityId: id,
        entityName: transferRequest.task.title,
        notes: note || undefined,
      });

      return NextResponse.json(updated);
    }

    // ============================================================
    // Cancel: requester cancels their own PENDING_ADMIN request
    // ============================================================
    if (action === "cancel") {
      if (session.user.id !== transferRequest.requesterId && !["ADMIN", "MANAGER"].includes(session.user.role)) {
        return NextResponse.json({ error: "فقط مقدم الطلب أو الإدارة يمكنهم إلغاء الطلب" }, { status: 403 });
      }

      if (transferRequest.status !== "PENDING_ADMIN") {
        return NextResponse.json({ error: "لا يمكن إلغاء طلب تمت مراجعته" }, { status: 400 });
      }

      const updated = await prisma.taskTransferRequest.update({
        where: { id },
        data: { status: "CANCELLED" },
        include: {
          task: true,
          requester: { select: { id: true, name: true } },
          targetUser: { select: { id: true, name: true } },
        },
      });

      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: "إجراء غير معروف" }, { status: 400 });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

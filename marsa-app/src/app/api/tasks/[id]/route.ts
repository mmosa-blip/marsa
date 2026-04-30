import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/api-auth";
import { pusherServer } from "@/lib/pusher";
import { logger } from "@/lib/logger";
import { getBlockingTaskRecordLinks } from "@/lib/record-spawn";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();

    const { id } = await params;
    const body = await request.json();

    // Assignee changes are admin-only as a general rule, with one exception:
    // an executor may claim an orphan task (assigneeId === null) by setting
    // it to themselves. This powers the "📋 التقط المهمة" button on
    // unassigned rows in project mode. Any other assignee mutation by a
    // non-admin is silently stripped.
    if (body.assigneeId !== undefined && !["ADMIN", "MANAGER"].includes(session.user.role)) {
      const claimingSelf = body.assigneeId === session.user.id;
      if (claimingSelf) {
        const current = await prisma.task.findUnique({
          where: { id },
          select: { assigneeId: true },
        });
        if (current?.assigneeId !== null) {
          // Already assigned to someone — non-admins can't reassign
          delete body.assigneeId;
        }
      } else {
        delete body.assigneeId;
      }
    }

    // Pre-update snapshot — needed for the payment-locked guard AND for the
    // city-canvas Pusher fan-out below (we only want to fire if the status
    // actually changes, and we need the previous value to know that).
    let prevStatus: string | null = null;
    let prevProjectId: string | null = null;
    if (body.status) {
      const existingTask = await prisma.task.findUnique({
        where: { id },
        include: { linkedInstallment: { select: { isLocked: true, paymentStatus: true, title: true } } },
      });

      if (existingTask?.linkedInstallment?.isLocked) {
        return NextResponse.json(
          { error: `المهمة محظورة حتى يتم دفع الدفعة: ${existingTask.linkedInstallment.title}` },
          { status: 403 }
        );
      }
      prevStatus = existingTask?.status ?? null;
      prevProjectId = existingTask?.projectId ?? null;

      // Tier 4 — block DONE while any linked record item isn't APPROVED.
      if (body.status === "DONE" && prevStatus !== "DONE") {
        const blocking = await getBlockingTaskRecordLinks(id);
        if (blocking.length > 0) {
          return NextResponse.json(
            {
              error: "لا يمكن إنهاء المهمة — توجد متطلبات سجل ناقصة",
              blockingRecordItems: blocking,
            },
            { status: 400 }
          );
        }
      }
    }

    // If assigneeId is being set manually, also create TaskAssignment record
    const manualAssign = body.assigneeId !== undefined && body.assigneeId !== null;
    if (manualAssign) {
      body.assignedAt = new Date();
    }

    const task = await prisma.task.update({
      where: { id },
      data: body,
      include: {
        service: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true } },
      },
    });

    // Sync TaskAssignment records with the new primary assignee
    if (manualAssign && task.assigneeId) {
      await prisma.taskAssignment.upsert({
        where: { taskId_userId: { taskId: id, userId: task.assigneeId } },
        create: { taskId: id, userId: task.assigneeId },
        update: {},
      });
    }

    // ── Realtime fan-out for the city canvas ──
    // The /dashboard/executor-city and /dashboard/all-cities pages listen
    // on the public "task-updates" channel. We fire only on real status
    // transitions, and only for tasks tied to a project (skipping any
    // orphan/personal tasks that wouldn't have a building to update).
    const projectId = task.projectId ?? prevProjectId;
    if (body.status && prevStatus !== null && task.status !== prevStatus && projectId) {
      try {
        await pusherServer.trigger("task-updates", "status-changed", {
          projectId,
          taskId: task.id,
          status: task.status,
        });
        if (task.status === "DONE" && prevStatus !== "DONE") {
          await pusherServer.trigger("task-updates", "task-completed", {
            projectId,
            taskId: task.id,
          });
        }
      } catch (err) {
        // Pusher availability isn't a hard dependency — log and move on.
        logger.error("Pusher task-updates trigger failed", err, { taskId: id });
      }
    }

    return NextResponse.json(task);
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error updating task:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["ADMIN", "MANAGER"]);

    const { id } = await params;

    // Soft delete: set status to CANCELLED instead of hard delete
    await prisma.task.update({
      where: { id },
      data: { status: "CANCELLED" },
    });

    return NextResponse.json({ message: "تم حذف المهمة" });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error deleting task:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

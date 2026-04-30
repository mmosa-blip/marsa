import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAuditLog, AuditModule } from "@/lib/audit";
import { getBlockingTaskRecordLinks } from "@/lib/record-spawn";

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
    const { status } = await request.json();
    const userId = session.user.id;

    const task = await prisma.task.findUnique({
      where: { id },
      select: { id: true, status: true, assigneeId: true, dueDate: true, assignedAt: true, startedById: true },
    });

    if (!task) {
      return NextResponse.json({ error: "المهمة غير موجودة" }, { status: 404 });
    }

    // Check if user is authorized (direct assignee or via TaskAssignment)
    const isAssigned = task.assigneeId === userId;
    const hasAssignment = await prisma.taskAssignment.findUnique({
      where: { taskId_userId: { taskId: id, userId } },
    });
    if (!isAssigned && !hasAssignment) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    // Guard: block DONE while required record items aren't APPROVED.
    // Returns 400 + blockingRecordItems so the UI can open the
    // TaskRecordLinksModal instead of a plain alert.
    if (status === "DONE" && task.status !== "DONE") {
      const blocking = await getBlockingTaskRecordLinks(id);
      if (blocking.length > 0) {
        return NextResponse.json(
          {
            error: "توجد متطلبات سجل ناقصة — ارفع المستندات المطلوبة أولاً",
            blockingRecordItems: blocking,
          },
          { status: 400 }
        );
      }
    }

    // BUG 3: If starting task, check if another executor already started it
    if (status === "IN_PROGRESS" && task.status === "TODO") {
      // No conflict, proceed - will be set below
    } else if (status === "IN_PROGRESS" && task.status === "IN_PROGRESS") {
      // Already in progress
      if (task.startedById && task.startedById !== userId) {
        const starter = await prisma.user.findUnique({ where: { id: task.startedById }, select: { name: true } });
        return NextResponse.json(
          { error: `المهمة بدأها منفذ آخر: ${starter?.name || ""}` },
          { status: 403 }
        );
      }
    }

    // Update task status
    const updated = await prisma.task.update({
      where: { id },
      data: {
        status,
        ...(status === "IN_PROGRESS" && task.status === "TODO" ? { startedById: userId } : {}),
        ...(status === "DONE" ? { startedById: null } : {}),
      },
    });

    const taskAction = status === "IN_PROGRESS" ? "TASK_STARTED" : status === "DONE" ? "TASK_COMPLETED" : "TASK_CANCELLED";
    createAuditLog({
      userId: session.user.id, userName: session.user.name || undefined, userRole: session.user.role,
      action: taskAction as any,
      module: AuditModule.TASKS,
      entityType: "Task", entityId: id, entityName: task.id,
      before: { status: task.status }, after: { status },
    });

    const now = new Date();

    // Create time log based on status transition
    if (status === "IN_PROGRESS" && task.status === "TODO") {
      await prisma.taskTimeLog.create({
        data: { taskId: id, userId, event: "STARTED", timestamp: now },
      });

      // Upsert time summary with startedAt
      await prisma.taskTimeSummary.upsert({
        where: { taskId: id },
        create: {
          taskId: id,
          assignedAt: task.assignedAt || now,
          startedAt: now,
        },
        update: { startedAt: now },
      });
    }

    if (status === "DONE" && (task.status === "IN_PROGRESS" || task.status === "TODO")) {
      await prisma.taskTimeLog.create({
        data: { taskId: id, userId, event: "COMPLETED", timestamp: now },
      });

      // Calculate durations from time logs
      const logs = await prisma.taskTimeLog.findMany({
        where: { taskId: id },
        orderBy: { timestamp: "asc" },
      });

      const assignedLog = logs.find((l) => l.event === "ASSIGNED");
      const startedLog = logs.find((l) => l.event === "STARTED");
      const completedLog = logs.find((l) => l.event === "COMPLETED");

      const assignedAt = assignedLog?.timestamp || task.assignedAt || now;
      const startedAt = startedLog?.timestamp || now;
      const completedAt = completedLog?.timestamp || now;

      const waitingDuration = Math.round((startedAt.getTime() - assignedAt.getTime()) / 60000);
      const executionDuration = Math.round((completedAt.getTime() - startedAt.getTime()) / 60000);
      const totalDuration = Math.round((completedAt.getTime() - assignedAt.getTime()) / 60000);
      const isLate = task.dueDate ? completedAt > task.dueDate : false;

      await prisma.taskTimeSummary.upsert({
        where: { taskId: id },
        create: {
          taskId: id,
          assignedAt,
          startedAt,
          completedAt,
          waitingDuration,
          executionDuration,
          totalDuration,
          isLate,
        },
        update: {
          completedAt,
          waitingDuration,
          executionDuration,
          totalDuration,
          isLate,
        },
      });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating task status:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

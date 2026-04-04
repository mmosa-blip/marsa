import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const { taskIds, status } = await request.json();

    if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0 || !status) {
      return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
    }

    // Verify all tasks belong to the current user
    const ownedCount = await prisma.task.count({
      where: {
        id: { in: taskIds },
        assigneeId: session.user.id,
      },
    });

    if (ownedCount !== taskIds.length) {
      return NextResponse.json({ error: "بعض المهام لا تنتمي إليك" }, { status: 403 });
    }

    // Fetch tasks before updating (for time tracking)
    const tasksBeforeUpdate = await prisma.task.findMany({
      where: { id: { in: taskIds }, assigneeId: session.user.id },
      select: { id: true, status: true, dueDate: true, assignedAt: true },
    });

    const result = await prisma.task.updateMany({
      where: {
        id: { in: taskIds },
        assigneeId: session.user.id,
      },
      data: { status },
    });

    // Create time logs and summaries for each task
    const now = new Date();
    for (const task of tasksBeforeUpdate) {
      if (status === "IN_PROGRESS" && task.status === "TODO") {
        await prisma.taskTimeLog.create({
          data: { taskId: task.id, userId: session.user.id, event: "STARTED", timestamp: now },
        });
        await prisma.taskTimeSummary.upsert({
          where: { taskId: task.id },
          create: { taskId: task.id, assignedAt: task.assignedAt || now, startedAt: now },
          update: { startedAt: now },
        });
      }

      if (status === "DONE" && (task.status === "IN_PROGRESS" || task.status === "TODO")) {
        await prisma.taskTimeLog.create({
          data: { taskId: task.id, userId: session.user.id, event: "COMPLETED", timestamp: now },
        });

        const logs = await prisma.taskTimeLog.findMany({
          where: { taskId: task.id },
          orderBy: { timestamp: "asc" },
        });
        const assignedLog = logs.find((l) => l.event === "ASSIGNED");
        const startedLog = logs.find((l) => l.event === "STARTED");

        const assignedAt = assignedLog?.timestamp || task.assignedAt || now;
        const startedAt = startedLog?.timestamp || now;
        const waitingDuration = Math.round((startedAt.getTime() - assignedAt.getTime()) / 60000);
        const executionDuration = Math.round((now.getTime() - startedAt.getTime()) / 60000);
        const totalDuration = Math.round((now.getTime() - assignedAt.getTime()) / 60000);
        const isLate = task.dueDate ? now > task.dueDate : false;

        await prisma.taskTimeSummary.upsert({
          where: { taskId: task.id },
          create: { taskId: task.id, assignedAt, startedAt, completedAt: now, waitingDuration, executionDuration, totalDuration, isLate },
          update: { completedAt: now, waitingDuration, executionDuration, totalDuration, isLate },
        });
      }
    }

    return NextResponse.json({ updated: result.count });
  } catch (error) {
    console.error("Error bulk updating tasks:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

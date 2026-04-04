import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const { projectId } = await params;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        client: { select: { id: true, name: true } },
        manager: { select: { id: true, name: true } },
        services: {
          select: {
            id: true,
            name: true,
            createdAt: true,
            tasks: {
              include: {
                assignee: { select: { id: true, name: true } },
                timeSummary: true,
              },
              orderBy: { order: "asc" },
            },
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "المشروع غير موجود" }, { status: 404 });
    }

    const allTasks = project.services.flatMap((s) => s.tasks);
    const completedTasks = allTasks.filter((t) => t.status === "DONE");
    const tasksWithSummary = allTasks.filter((t) => t.timeSummary);

    // Project dates
    const firstAssigned = tasksWithSummary
      .map((t) => t.timeSummary?.assignedAt)
      .filter(Boolean)
      .sort((a, b) => a!.getTime() - b!.getTime())[0];
    const lastCompleted = tasksWithSummary
      .map((t) => t.timeSummary?.completedAt)
      .filter(Boolean)
      .sort((a, b) => b!.getTime() - a!.getTime())[0];

    const totalDurationMinutes = firstAssigned && lastCompleted
      ? Math.round((lastCompleted!.getTime() - firstAssigned!.getTime()) / 60000)
      : null;

    // Services breakdown
    const services = project.services.map((s) => {
      const sTasks = s.tasks.filter((t) => t.timeSummary);
      const sCompleted = sTasks.filter((t) => t.timeSummary?.completedAt);
      const firstStart = sTasks
        .map((t) => t.timeSummary?.startedAt)
        .filter(Boolean)
        .sort((a, b) => a!.getTime() - b!.getTime())[0];
      const lastEnd = sCompleted
        .map((t) => t.timeSummary?.completedAt)
        .filter(Boolean)
        .sort((a, b) => b!.getTime() - a!.getTime())[0];

      return {
        name: s.name,
        startDate: firstStart || null,
        endDate: lastEnd || null,
        duration: firstStart && lastEnd
          ? Math.round((lastEnd!.getTime() - firstStart!.getTime()) / 60000)
          : null,
        tasks: s.tasks.map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          assigneeName: t.assignee?.name || "غير مسند",
          executionDuration: t.timeSummary?.executionDuration || null,
          isLate: t.timeSummary?.isLate || false,
        })),
      };
    });

    // Executors breakdown
    const executorMap = new Map<string, {
      name: string;
      tasks: typeof allTasks;
    }>();
    for (const t of allTasks) {
      if (!t.assignee) continue;
      if (!executorMap.has(t.assignee.id)) {
        executorMap.set(t.assignee.id, { name: t.assignee.name, tasks: [] });
      }
      executorMap.get(t.assignee.id)!.tasks.push(t);
    }
    const executors = [...executorMap.entries()].map(([id, e]) => {
      const completed = e.tasks.filter((t) => t.timeSummary?.completedAt);
      return {
        id,
        name: e.name,
        tasksCount: e.tasks.length,
        avgTime: completed.length > 0
          ? Math.round(completed.reduce((s, t) => s + (t.timeSummary?.executionDuration || 0), 0) / completed.length)
          : 0,
        lateTasksCount: e.tasks.filter((t) => t.timeSummary?.isLate).length,
      };
    });

    // Timeline events
    const timeLogs = await prisma.taskTimeLog.findMany({
      where: { task: { projectId } },
      include: {
        task: { select: { title: true } },
        user: { select: { name: true } },
      },
      orderBy: { timestamp: "asc" },
    });

    const timeline = timeLogs.map((l) => ({
      event: l.event,
      taskTitle: l.task.title,
      userName: l.user.name,
      timestamp: l.timestamp,
      note: l.note,
    }));

    // Efficiency
    const onTimeTasks = completedTasks.filter((t) => !t.timeSummary?.isLate).length;
    const efficiency = completedTasks.length > 0
      ? Math.round((onTimeTasks / completedTasks.length) * 100)
      : 100;

    return NextResponse.json({
      project: {
        id: project.id,
        name: project.name,
        client: project.client,
        manager: project.manager,
        status: project.status,
        startDate: project.startDate || firstAssigned,
        endDate: project.endDate,
        actualEndDate: lastCompleted || null,
        totalDuration: totalDurationMinutes,
        totalTasks: allTasks.length,
        completedTasks: completedTasks.length,
      },
      services,
      executors,
      timeline,
      efficiency,
    });
  } catch (error) {
    console.error("Error fetching project completion report:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can, PERMISSIONS } from "@/lib/permissions";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    if (!(await can(session.user.id, session.user.role, PERMISSIONS.REPORTS_TIME))) {
      return NextResponse.json({ error: "ليس لديك صلاحية" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const serviceId = searchParams.get("serviceId");
    const userId = searchParams.get("userId");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    // Build where clause
    const where: Record<string, unknown> = {
      project: { deletedAt: null },
    };
    if (projectId) where.projectId = projectId;
    if (serviceId) where.serviceId = serviceId;
    if (userId) where.assigneeId = userId;
    if (dateFrom || dateTo) {
      const dateFilter: Record<string, Date> = {};
      if (dateFrom) dateFilter.gte = new Date(dateFrom);
      if (dateTo) dateFilter.lte = new Date(dateTo + "T23:59:59");
      where.createdAt = dateFilter;
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        assignee: { select: { id: true, name: true } },
        project: { select: { id: true, name: true, projectCode: true } },
        service: { select: { id: true, name: true } },
        timeSummary: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Build response
    const taskList = tasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      assigneeName: t.assignee?.name || "غير مسند",
      assigneeId: t.assignee?.id || null,
      projectName: t.project?.name || "",
      projectId: t.project?.id || "",
      serviceName: t.service?.name || "",
      serviceId: t.service?.id || "",
      dueDate: t.dueDate,
      assignedAt: t.timeSummary?.assignedAt || t.assignedAt,
      startedAt: t.timeSummary?.startedAt || null,
      completedAt: t.timeSummary?.completedAt || null,
      waitingDuration: t.timeSummary?.waitingDuration || null,
      executionDuration: t.timeSummary?.executionDuration || null,
      totalDuration: t.timeSummary?.totalDuration || null,
      isLate: t.timeSummary?.isLate || false,
    }));

    const completedTasks = taskList.filter((t) => t.completedAt);
    const lateTasks = taskList.filter((t) => t.isLate);

    const avgWaitingTime = completedTasks.length > 0
      ? Math.round(completedTasks.reduce((s, t) => s + (t.waitingDuration || 0), 0) / completedTasks.length)
      : 0;
    const avgExecutionTime = completedTasks.length > 0
      ? Math.round(completedTasks.reduce((s, t) => s + (t.executionDuration || 0), 0) / completedTasks.length)
      : 0;
    const avgTotalTime = completedTasks.length > 0
      ? Math.round(completedTasks.reduce((s, t) => s + (t.totalDuration || 0), 0) / completedTasks.length)
      : 0;

    // By executor
    const executorMap = new Map<string, { userId: string; name: string; tasks: typeof taskList }>();
    for (const t of taskList) {
      if (!t.assigneeId) continue;
      if (!executorMap.has(t.assigneeId)) {
        executorMap.set(t.assigneeId, { userId: t.assigneeId, name: t.assigneeName, tasks: [] });
      }
      executorMap.get(t.assigneeId)!.tasks.push(t);
    }
    const byExecutor = [...executorMap.values()].map((e) => {
      const completed = e.tasks.filter((t) => t.completedAt);
      return {
        userId: e.userId,
        name: e.name,
        taskCount: e.tasks.length,
        completedCount: completed.length,
        avgExecutionTime: completed.length > 0
          ? Math.round(completed.reduce((s, t) => s + (t.executionDuration || 0), 0) / completed.length)
          : 0,
        lateCount: e.tasks.filter((t) => t.isLate).length,
      };
    });

    // By service
    const serviceMap = new Map<string, { serviceId: string; name: string; tasks: typeof taskList }>();
    for (const t of taskList) {
      if (!t.serviceId) continue;
      if (!serviceMap.has(t.serviceId)) {
        serviceMap.set(t.serviceId, { serviceId: t.serviceId, name: t.serviceName, tasks: [] });
      }
      serviceMap.get(t.serviceId)!.tasks.push(t);
    }
    const byService = [...serviceMap.values()].map((s) => {
      const completed = s.tasks.filter((t) => t.completedAt);
      return {
        serviceId: s.serviceId,
        name: s.name,
        taskCount: s.tasks.length,
        avgDuration: completed.length > 0
          ? Math.round(completed.reduce((sum, t) => sum + (t.executionDuration || 0), 0) / completed.length)
          : 0,
      };
    });

    // By project
    const projectMap = new Map<string, { projectId: string; name: string; tasks: typeof taskList }>();
    for (const t of taskList) {
      if (!t.projectId) continue;
      if (!projectMap.has(t.projectId)) {
        projectMap.set(t.projectId, { projectId: t.projectId, name: t.projectName, tasks: [] });
      }
      projectMap.get(t.projectId)!.tasks.push(t);
    }
    const byProject = [...projectMap.values()].map((p) => {
      const completed = p.tasks.filter((t) => t.completedAt);
      return {
        projectId: p.projectId,
        name: p.name,
        taskCount: p.tasks.length,
        completedTasks: completed.length,
        totalDuration: completed.reduce((s, t) => s + (t.totalDuration || 0), 0),
      };
    });

    return NextResponse.json({
      tasks: taskList,
      summary: {
        totalTasks: taskList.length,
        completedTasks: completedTasks.length,
        lateTasks: lateTasks.length,
        avgWaitingTime,
        avgExecutionTime,
        avgTotalTime,
        byExecutor,
        byService,
        byProject,
      },
    });
  } catch (error) {
    console.error("Error fetching time tracking report:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

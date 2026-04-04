import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const role = session.user.role;
    const userId = session.user.id;

    if (role === "ADMIN" || role === "MANAGER") {
      return NextResponse.json(await getAdminStats());
    }

    if (role === "EXECUTOR") {
      return NextResponse.json(await getExecutorStats(userId));
    }

    if (role === "EXTERNAL_PROVIDER") {
      return NextResponse.json(await getProviderStats(userId));
    }

    return NextResponse.json(await getClientStats(userId));
  } catch (error) {
    console.error("Dashboard error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

async function getClientStats(userId: string) {
  const [projects, allTasks, services] = await Promise.all([
    prisma.project.findMany({
      where: { clientId: userId, deletedAt: null },
      include: {
        manager: { select: { name: true } },
        tasks: { select: { id: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.task.findMany({
      where: { project: { clientId: userId } },
      select: { status: true },
    }),
    prisma.service.findMany({ where: { isActive: true }, select: { id: true } }),
  ]);

  const activeProjects = projects.filter((p) => p.status === "ACTIVE").length;
  const completedTasks = allTasks.filter((t) => t.status === "DONE").length;
  const inProgressTasks = allTasks.filter((t) => t.status === "IN_PROGRESS").length;
  const totalTasks = allTasks.length;

  // بيانات تقدم المشاريع للرسم البياني
  const projectsProgress = projects.slice(0, 5).map((p) => {
    const done = p.tasks.filter((t) => t.status === "DONE").length;
    const total = p.tasks.length;
    return {
      name: p.name.length > 20 ? p.name.substring(0, 20) + "..." : p.name,
      progress: total > 0 ? Math.round((done / total) * 100) : 0,
      total,
      done,
    };
  });

  // آخر المشاريع
  const recentProjects = projects.slice(0, 4).map((p) => {
    const done = p.tasks.filter((t) => t.status === "DONE").length;
    const total = p.tasks.length;
    return {
      id: p.id,
      name: p.name,
      status: p.status,
      priority: p.priority,
      manager: p.manager?.name || null,
      progress: total > 0 ? Math.round((done / total) * 100) : 0,
    };
  });

  return {
    type: "client",
    stats: {
      activeProjects,
      completedTasks,
      totalServices: services.length,
      inProgressTasks,
      totalTasks,
    },
    projectsProgress,
    recentProjects,
  };
}

async function getExecutorStats(userId: string) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [allTasks, completedThisMonth, recentActivity] = await Promise.all([
    prisma.task.findMany({
      where: { assigneeId: userId },
      include: {
        project: { select: { id: true, name: true, client: { select: { name: true } } } },
        service: { select: { name: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.task.count({
      where: { assigneeId: userId, status: "DONE", updatedAt: { gte: monthStart } },
    }),
    prisma.task.findMany({
      where: { assigneeId: userId, updatedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      include: { project: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
      take: 10,
    }),
  ]);

  const totalAssigned = allTasks.length;
  const inProgress = allTasks.filter(t => t.status === "IN_PROGRESS").length;
  const inReview = allTasks.filter(t => t.status === "IN_REVIEW").length;

  return {
    type: "executor",
    stats: { totalAssigned, inProgress, inReview, completedThisMonth },
    tasks: allTasks,
    recentActivity,
  };
}

async function getProviderStats(userId: string) {
  const [allTasks, paymentRequests] = await Promise.all([
    prisma.task.findMany({
      where: { assigneeId: userId },
      include: {
        project: { select: { id: true, name: true } },
        service: { select: { name: true } },
        taskCosts: { where: { providerId: userId }, select: { amount: true, paymentRequest: { select: { id: true, status: true } } } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.paymentRequest.findMany({
      where: { providerId: userId },
      include: { taskCost: { include: { task: { select: { title: true } } } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const totalAssigned = allTasks.length;
  const completedTasks = allTasks.filter(t => t.status === "DONE").length;
  const totalEarnings = paymentRequests.filter(p => p.status === "PAID").reduce((sum, p) => sum + p.amount, 0);
  const pendingAmount = paymentRequests.filter(p => !["PAID", "REJECTED"].includes(p.status)).reduce((sum, p) => sum + p.amount, 0);

  return {
    type: "provider",
    stats: { totalAssigned, completedTasks, totalEarnings, pendingAmount },
    tasks: allTasks,
    paymentRequests: paymentRequests.slice(0, 10),
  };
}

async function getAdminStats() {
  const now = new Date();

  const [
    totalClients,
    totalProjects,
    activeProjects,
    allTasks,
    services,
    recentProjects,
    executors,
    allProjectsWithTasks,
  ] = await Promise.all([
    prisma.user.count({ where: { role: "CLIENT" } }),
    prisma.project.count({ where: { deletedAt: null } }),
    prisma.project.count({ where: { status: "ACTIVE", deletedAt: null } }),
    prisma.task.findMany({ select: { status: true } }),
    prisma.service.findMany({
      where: { isActive: true },
      include: { tasks: { select: { id: true } } },
    }),
    prisma.project.findMany({
      where: { deletedAt: null },
      include: {
        client: { select: { name: true } },
        tasks: { select: { status: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.user.findMany({
      where: { role: "EXECUTOR" },
      select: {
        id: true,
        name: true,
        assignedTasks: { select: { status: true } },
      },
    }),
    // All non-deleted projects with task details for status overview
    prisma.project.findMany({
      where: { deletedAt: null, status: { notIn: ["CANCELLED"] } },
      include: {
        client: { select: { name: true } },
        tasks: {
          where: { status: { notIn: ["CANCELLED"] } },
          select: { id: true, status: true, dueDate: true },
        },
      },
    }),
  ]);

  const pendingTasks = allTasks.filter((t) => t.status === "TODO").length;
  const completedTasks = allTasks.filter((t) => t.status === "DONE").length;

  // === نظرة عامة على حالات المشاريع ===
  let statusActive = 0;
  let statusCompleted = 0;
  let statusDelayed = 0;
  let statusOnHold = 0;

  interface DelayedProject {
    id: string;
    name: string;
    client: string;
    delayedTasks: number;
    maxDelayDays: number;
  }
  const delayedProjects: DelayedProject[] = [];

  for (const p of allProjectsWithTasks) {
    // Count overdue tasks
    const overdueTasks = p.tasks.filter(
      (t) => t.dueDate && new Date(t.dueDate) < now && t.status !== "DONE"
    );

    if (p.status === "COMPLETED") {
      statusCompleted++;
    } else if (p.status === "ON_HOLD") {
      statusOnHold++;
    } else if (overdueTasks.length > 0) {
      // Project has overdue tasks → delayed
      statusDelayed++;
      const maxDelay = Math.max(
        ...overdueTasks.map((t) =>
          Math.floor((now.getTime() - new Date(t.dueDate!).getTime()) / (1000 * 60 * 60 * 24))
        )
      );
      delayedProjects.push({
        id: p.id,
        name: p.name,
        client: p.client?.name || "غير محدد",
        delayedTasks: overdueTasks.length,
        maxDelayDays: maxDelay,
      });
    } else {
      // ACTIVE, DRAFT, or any other active status
      statusActive++;
    }
  }

  // Sort delayed projects by maxDelayDays desc, take top 5
  delayedProjects.sort((a, b) => b.maxDelayDays - a.maxDelayDays);

  // بيانات الإيرادات الشهرية (تجريبية)
  const monthlyRevenue = [
    { month: "يناير", revenue: 45000 },
    { month: "فبراير", revenue: 52000 },
    { month: "مارس", revenue: 48000 },
    { month: "أبريل", revenue: 61000 },
    { month: "مايو", revenue: 55000 },
    { month: "يونيو", revenue: 67000 },
  ];

  // آخر الطلبات
  const recentOrders = recentProjects.map((p) => {
    const done = p.tasks.filter((t) => t.status === "DONE").length;
    const total = p.tasks.length;
    return {
      id: p.id,
      name: p.name,
      client: p.client?.name || "غير محدد",
      status: p.status,
      progress: total > 0 ? Math.round((done / total) * 100) : 0,
    };
  });

  // أداء المنفذين
  const executorPerformance = executors.map((e) => {
    const total = e.assignedTasks.length;
    const done = e.assignedTasks.filter((t) => t.status === "DONE").length;
    const inProgress = e.assignedTasks.filter((t) => t.status === "IN_PROGRESS").length;
    return {
      id: e.id,
      name: e.name,
      totalTasks: total,
      completedTasks: done,
      inProgressTasks: inProgress,
      rate: total > 0 ? Math.round((done / total) * 100) : 0,
    };
  });

  // Quick service stats
  const [quickServiceCount, quickServiceActive, quickServiceCompleted] = await Promise.all([
    prisma.project.count({ where: { isQuickService: true, deletedAt: null } }),
    prisma.project.count({ where: { isQuickService: true, status: "ACTIVE", deletedAt: null } }),
    prisma.project.count({ where: { isQuickService: true, status: "COMPLETED", deletedAt: null } }),
  ]);

  // حساب الإيرادات التقديرية
  const totalRevenue = services.reduce((sum, s) => {
    return sum + (s.tasks.length * (services.find((sv) => sv.id === s.id) ? 3500 : 0));
  }, 0);

  return {
    type: "admin",
    stats: {
      totalClients,
      totalProjects,
      activeProjects,
      totalRevenue: totalRevenue || 328000,
      pendingTasks,
      completedTasks,
      totalTasks: allTasks.length,
    },
    monthlyRevenue,
    projectsByStatus: {
      active: statusActive,
      completed: statusCompleted,
      delayed: statusDelayed,
      onHold: statusOnHold,
    },
    delayedProjects: delayedProjects.slice(0, 5),
    recentOrders,
    executorPerformance,
    quickService: { total: quickServiceCount, active: quickServiceActive, completed: quickServiceCompleted },
  };
}

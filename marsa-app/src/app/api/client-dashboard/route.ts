import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "غير مسجل الدخول" }, { status: 401 });
    }
    if (session.user.role !== "CLIENT") {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const userId = session.user.id;
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [
      projects,
      services,
      expiringDocs,
      upcomingReminders,
      recentTasks,
    ] = await Promise.all([
      // Projects with task counts only (no internal details)
      prisma.project.findMany({
        where: { clientId: userId, deletedAt: null },
        include: {
          tasks: { select: { status: true } },
        },
        orderBy: { updatedAt: "desc" },
      }),
      // Services
      prisma.service.findMany({
        where: { clientId: userId },
        orderBy: { createdAt: "desc" },
      }),
      // Documents expiring within 30 days
      prisma.document.findMany({
        where: {
          ownerId: userId,
          expiryDate: {
            gte: now,
            lte: thirtyDaysFromNow,
          },
          status: { not: "EXPIRED" },
        },
        select: { id: true, title: true, type: true, expiryDate: true },
      }),
      // Upcoming reminders
      prisma.reminder.findMany({
        where: {
          clientId: userId,
          status: "PENDING",
        },
        select: {
          id: true,
          title: true,
          type: true,
          dueDate: true,
          priority: true,
        },
        orderBy: { dueDate: "asc" },
        take: 5,
      }),
      // Recent task status updates (no titles or assignee details for client privacy)
      prisma.task.findMany({
        where: {
          project: { clientId: userId },
        },
        select: {
          id: true,
          status: true,
          updatedAt: true,
          service: { select: { name: true } },
          project: { select: { id: true, name: true, projectCode: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 5,
      }),
    ]);

    // Calculate stats
    const activeProjects = projects.filter((p) => p.status === "ACTIVE").length;
    const activeServices = services.filter((s) => s.status === "IN_PROGRESS").length;
    const expiringDocuments = expiringDocs.length;

    // Recent projects (last 3)
    const recentProjects = projects.slice(0, 3).map((p) => {
      const totalTasks = p.tasks.length;
      const completedTasks = p.tasks.filter((t) => t.status === "DONE").length;
      const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
      return {
        id: p.id,
        name: p.name,
        projectCode: p.projectCode,
        status: p.status,
        priority: p.priority,
        progress,
      };
    });

    // Recent standalone services (last 3 without projectId)
    const recentServices = services
      .filter((s) => !s.projectId)
      .slice(0, 3)
      .map(({ id, name, category, status, price, createdAt }) => ({
        id,
        name,
        category,
        status,
        price,
        createdAt,
      }));

    // Recent activities (show service/project name instead of task title)
    const recentActivities = recentTasks.map((t) => ({
      id: t.id,
      status: t.status,
      updatedAt: t.updatedAt,
      serviceName: (t as unknown as { service?: { name: string } }).service?.name || null,
      projectName: t.project.name,
    }));

    return NextResponse.json({
      stats: {
        activeProjects,
        activeServices,
        expiringDocuments,
      },
      alerts: {
        expiringDocuments: expiringDocs,
        upcomingReminders,
      },
      recentProjects,
      recentServices,
      recentActivities,
    });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

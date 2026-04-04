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
      pendingInvoices,
      upcomingReminders,
      recentTasks,
    ] = await Promise.all([
      // Projects with tasks
      prisma.project.findMany({
        where: { clientId: userId, deletedAt: null },
        include: {
          tasks: { select: { status: true } },
          manager: { select: { name: true } },
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
      // Pending invoices (SENT + OVERDUE)
      prisma.invoice.findMany({
        where: {
          clientId: userId,
          status: { in: ["SENT", "OVERDUE"] },
        },
        select: {
          id: true,
          invoiceNumber: true,
          totalAmount: true,
          dueDate: true,
          status: true,
        },
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
      // Recent tasks from client's projects
      prisma.task.findMany({
        where: {
          project: { clientId: userId },
        },
        select: {
          id: true,
          title: true,
          status: true,
          updatedAt: true,
          project: { select: { name: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 5,
      }),
    ]);

    // Calculate stats
    const activeProjects = projects.filter((p) => p.status === "ACTIVE").length;
    const activeServices = services.filter((s) => s.status === "IN_PROGRESS").length;
    const expiringDocuments = expiringDocs.length;
    const pendingInvoicesTotal = pendingInvoices.reduce(
      (sum, inv) => sum + inv.totalAmount,
      0
    );

    // Overdue invoices
    const overdueInvoices = pendingInvoices
      .filter((inv) => inv.status === "OVERDUE")
      .map(({ id, invoiceNumber, totalAmount, dueDate }) => ({
        id,
        invoiceNumber,
        totalAmount,
        dueDate,
      }));

    // Recent projects (last 3)
    const recentProjects = projects.slice(0, 3).map((p) => {
      const totalTasks = p.tasks.length;
      const completedTasks = p.tasks.filter((t) => t.status === "DONE").length;
      const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
      return {
        id: p.id,
        name: p.name,
        status: p.status,
        priority: p.priority,
        progress,
        totalTasks,
        completedTasks,
        manager: p.manager?.name || null,
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

    // Recent activities
    const recentActivities = recentTasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      updatedAt: t.updatedAt,
      projectName: t.project.name,
    }));

    return NextResponse.json({
      stats: {
        activeProjects,
        activeServices,
        expiringDocuments,
        pendingInvoicesTotal,
      },
      alerts: {
        expiringDocuments: expiringDocs,
        overdueInvoices,
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

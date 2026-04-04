import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (
      !session ||
      (session.user.role !== "ADMIN" && session.user.role !== "MANAGER")
    ) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const { id } = await params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        isActive: true,
        isExternal: true,
        createdAt: true,
        updatedAt: true,
        authorizationType: true,
        specialization: true,
        costPerTask: true,
        bankName: true,
        bankIban: true,
        supervisorId: true,
        supervisor: { select: { id: true, name: true } },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "المستخدم غير موجود" },
        { status: 404 }
      );
    }

    let roleData: Record<string, unknown> = {};

    if (user.role === "EXECUTOR" || user.role === "EXTERNAL_PROVIDER") {
      const [
        assignedTasksCount,
        completedTasksCount,
        inProgressTasksCount,
        rejectionsCount,
        providedServices,
        recentTasks,
        taskRejections,
      ] = await Promise.all([
        prisma.task.count({ where: { assigneeId: id } }),
        prisma.task.count({ where: { assigneeId: id, status: "DONE" } }),
        prisma.task.count({
          where: { assigneeId: id, status: "IN_PROGRESS" },
        }),
        prisma.taskRejection.count({ where: { providerId: id } }),
        prisma.serviceProviderMapping.findMany({
          where: { providerId: id },
          include: {
            serviceTemplate: {
              select: {
                id: true,
                name: true,
                category: { select: { id: true, name: true } },
              },
            },
          },
          orderBy: { priority: "asc" },
        }),
        prisma.task.findMany({
          where: { assigneeId: id },
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            dueDate: true,
            createdAt: true,
            project: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        }),
        prisma.taskRejection.findMany({
          where: { providerId: id },
          select: {
            id: true,
            reason: true,
            createdAt: true,
            task: { select: { id: true, title: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        }),
      ]);

      roleData = {
        stats: {
          assignedTasks: assignedTasksCount,
          completedTasks: completedTasksCount,
          inProgressTasks: inProgressTasksCount,
          rejections: rejectionsCount,
        },
        providedServices,
        recentTasks,
        taskRejections,
      };
    } else if (user.role === "CLIENT") {
      const [
        projectsCount,
        servicesCount,
        invoicesCount,
        documentsCount,
        recentProjects,
        recentInvoices,
      ] = await Promise.all([
        prisma.project.count({ where: { clientId: id } }),
        prisma.service.count({ where: { clientId: id } }),
        prisma.invoice.count({ where: { clientId: id } }),
        prisma.document.count({ where: { ownerId: id } }),
        prisma.project.findMany({
          where: { clientId: id, deletedAt: null },
          select: {
            id: true,
            name: true,
            status: true,
            priority: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 5,
        }),
        prisma.invoice.findMany({
          where: { clientId: id },
          select: {
            id: true,
            invoiceNumber: true,
            title: true,
            totalAmount: true,
            status: true,
            dueDate: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 5,
        }),
      ]);

      roleData = {
        stats: {
          projects: projectsCount,
          services: servicesCount,
          invoices: invoicesCount,
          documents: documentsCount,
        },
        recentProjects,
        recentInvoices,
      };
    }

    return NextResponse.json({ ...user, ...roleData });
  } catch (error) {
    console.error("Error fetching user details:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

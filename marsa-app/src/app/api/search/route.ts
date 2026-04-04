import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() || "";

    if (q.length < 2) {
      return NextResponse.json(
        { error: "يجب أن يكون البحث حرفين على الأقل" },
        { status: 400 }
      );
    }

    const userId = session.user.id;
    const userRole = session.user.role;
    const isAdminOrManager = userRole === "ADMIN" || userRole === "MANAGER";

    // Search Users - ADMIN/MANAGER only
    let users: { id: string; name: string; email: string; role: string; link: string }[] = [];
    if (isAdminOrManager) {
      const foundUsers = await prisma.user.findMany({
        where: {
          OR: [
            { name: { contains: q } },
            { email: { contains: q } },
          ],
        },
        select: { id: true, name: true, email: true, role: true },
        take: 5,
      });
      users = foundUsers.map((u) => ({
        ...u,
        link: `/dashboard/users/${u.id}`,
      }));
    }

    // Search Companies (clients)
    const clientsWhere: Record<string, unknown> = {
      OR: [
        { name: { contains: q } },
        { commercialRegister: { contains: q } },
      ],
    };
    if (userRole === "CLIENT") {
      clientsWhere.ownerId = userId;
    }
    const foundClients = isAdminOrManager || userRole === "CLIENT"
      ? await prisma.company.findMany({
          where: clientsWhere,
          select: {
            id: true,
            name: true,
            commercialRegister: true,
            owner: { select: { name: true } },
          },
          take: 5,
        })
      : [];
    const clients = foundClients.map((c) => ({
      id: c.id,
      name: c.name,
      commercialRegister: c.commercialRegister,
      ownerName: c.owner.name,
      link: `/dashboard/clients/${c.id}`,
    }));

    // Search Projects
    const projectsWhere: Record<string, unknown> = {
      deletedAt: null,
      name: { contains: q },
    };
    if (userRole === "CLIENT") {
      projectsWhere.clientId = userId;
    } else if (userRole === "EXECUTOR" || userRole === "EXTERNAL_PROVIDER") {
      projectsWhere.tasks = { some: { assigneeId: userId } };
    }
    const foundProjects = await prisma.project.findMany({
      where: projectsWhere,
      select: {
        id: true,
        name: true,
        status: true,
        client: { select: { name: true } },
      },
      take: 5,
    });
    const projects = foundProjects.map((p) => ({
      id: p.id,
      name: p.name,
      status: p.status,
      clientName: p.client.name,
      link: `/dashboard/projects/${p.id}`,
    }));

    // Search Tasks
    const tasksWhere: Record<string, unknown> = {
      title: { contains: q },
    };
    if (userRole === "CLIENT") {
      tasksWhere.project = { clientId: userId };
    } else if (userRole === "EXECUTOR" || userRole === "EXTERNAL_PROVIDER") {
      tasksWhere.assigneeId = userId;
    }
    const foundTasks = await prisma.task.findMany({
      where: tasksWhere,
      select: {
        id: true,
        title: true,
        status: true,
        projectId: true,
        project: { select: { name: true } },
      },
      take: 5,
    });
    const tasks = foundTasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      projectName: t.project.name,
      link: `/dashboard/projects/${t.projectId}`,
    }));

    // Search Invoices
    const invoicesWhere: Record<string, unknown> = {
      OR: [
        { invoiceNumber: { contains: q } },
        { title: { contains: q } },
      ],
    };
    if (userRole === "CLIENT") {
      invoicesWhere.clientId = userId;
    }
    const canSearchInvoices = isAdminOrManager || userRole === "CLIENT" || userRole === "FINANCE_MANAGER" || userRole === "TREASURY_MANAGER";
    const foundInvoices = canSearchInvoices
      ? await prisma.invoice.findMany({
          where: invoicesWhere,
          select: {
            id: true,
            invoiceNumber: true,
            title: true,
            totalAmount: true,
            status: true,
          },
          take: 5,
        })
      : [];
    const invoices = foundInvoices.map((i) => ({
      id: i.id,
      invoiceNumber: i.invoiceNumber,
      title: i.title,
      totalAmount: i.totalAmount,
      status: i.status,
      link: `/dashboard/finance/invoices/${i.id}`,
    }));

    return NextResponse.json({
      users,
      clients,
      projects,
      tasks,
      invoices,
    });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json({ error: "حدث خطأ في البحث" }, { status: 500 });
  }
}

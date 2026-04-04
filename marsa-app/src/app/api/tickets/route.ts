import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAuditLog, AuditModule } from "@/lib/audit";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const priority = searchParams.get("priority");
    const category = searchParams.get("category");

    const role = session.user.role;
    const userId = session.user.id;
    const isAdmin = ["ADMIN", "MANAGER"].includes(role);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (isAdmin) {
      // Admin/Manager see all tickets
    } else if (role === "CLIENT") {
      where.clientId = userId;
    } else if (role === "EXECUTOR") {
      where.OR = [
        { agentId: userId },
        { clientId: userId },
        { agentId: null },
      ];
    } else {
      where.OR = [
        { agentId: userId },
        { clientId: userId },
      ];
    }

    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (category) where.category = category;

    const tickets = await prisma.ticket.findMany({
      where,
      include: {
        client: { select: { id: true, name: true, email: true } },
        agent: { select: { id: true, name: true } },
        contract: {
          select: {
            id: true,
            template: { select: { title: true } },
          },
        },
        installment: {
          select: {
            id: true,
            title: true,
            amount: true,
            paymentStatus: true,
          },
        },
        _count: { select: { messages: true } },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            body: true,
            createdAt: true,
            sender: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json(tickets);
  } catch (error) {
    console.error("Error fetching tickets:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const body = await request.json();
    const { subject, category, description, priority, contractId, installmentId, clientId: bodyClientId } = body;

    if (!subject || !category || !description) {
      return NextResponse.json({ error: "بيانات غير مكتملة: الموضوع والتصنيف والوصف مطلوبة" }, { status: 400 });
    }

    const role = session.user.role;
    const userId = session.user.id;
    const isAdmin = ["ADMIN", "MANAGER"].includes(role);

    let clientId: string;
    if (role === "CLIENT") {
      clientId = userId;
    } else if (isAdmin) {
      if (!bodyClientId) {
        return NextResponse.json({ error: "يجب تحديد العميل" }, { status: 400 });
      }
      clientId = bodyClientId;
    } else {
      clientId = userId;
    }

    const ticketNumber = `TKT-${Date.now().toString().slice(-6)}`;

    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        subject,
        category,
        description,
        priority: priority || "MEDIUM",
        status: "NEW",
        clientId,
        contractId: contractId || null,
        installmentId: installmentId || null,
      },
      include: {
        client: { select: { id: true, name: true, email: true } },
        agent: { select: { id: true, name: true } },
        contract: {
          select: {
            id: true,
            template: { select: { title: true } },
          },
        },
        installment: {
          select: {
            id: true,
            title: true,
            amount: true,
            paymentStatus: true,
          },
        },
        messages: true,
      },
    });

    // Notify admins/managers about new ticket
    const managers = await prisma.user.findMany({
      where: { role: { in: ["ADMIN", "MANAGER"] }, isActive: true, deletedAt: null },
      select: { id: true },
    });
    if (managers.length > 0) {
      await prisma.notification.createMany({
        data: managers
          .filter((m) => m.id !== userId)
          .map((m) => ({
            userId: m.id,
            type: "TASK_UPDATE" as const,
            message: `تذكرة دعم جديدة: ${subject} (${ticketNumber})`,
            link: `/dashboard/tickets`,
          })),
      });
    }

    createAuditLog({
      userId: session.user.id, userName: session.user.name || undefined, userRole: session.user.role,
      action: "TICKET_CREATED", module: AuditModule.TICKETS,
      entityType: "Ticket", entityId: ticket.id, entityName: ticket.subject,
      after: { ticketNumber, category, priority: priority || "MEDIUM" },
    });

    return NextResponse.json(ticket, { status: 201 });
  } catch (error) {
    console.error("Error creating ticket:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAuditLog, AuditModule } from "@/lib/audit";
import { can, PERMISSIONS } from "@/lib/permissions";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const { id } = await params;
    const role = session.user.role;
    const userId = session.user.id;
    const isAdmin = ["ADMIN", "MANAGER"].includes(role);

    const ticket = await prisma.ticket.findUnique({
      where: { id },
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
        messages: {
          orderBy: { createdAt: "asc" },
          include: {
            sender: { select: { id: true, name: true, role: true } },
            attachments: true,
          },
        },
        attachments: true,
      },
    });

    if (!ticket) {
      return NextResponse.json({ error: "التذكرة غير موجودة" }, { status: 404 });
    }

    // Access check: client, assigned agent, admin/manager
    if (!isAdmin && ticket.clientId !== userId && ticket.agentId !== userId) {
      return NextResponse.json({ error: "غير مصرح بالوصول لهذه التذكرة" }, { status: 403 });
    }

    // Filter internal messages for clients
    if (role === "CLIENT") {
      ticket.messages = ticket.messages.filter((m) => !m.isInternal);
    }

    return NextResponse.json(ticket);
  } catch (error) {
    console.error("Error fetching ticket:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { action, agentId, priority, category, body: messageBody, isInternal } = body;

    const role = session.user.role;
    const userId = session.user.id;
    const isAdmin = ["ADMIN", "MANAGER"].includes(role);

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true } },
        agent: { select: { id: true, name: true } },
      },
    });

    if (!ticket) {
      return NextResponse.json({ error: "التذكرة غير موجودة" }, { status: 404 });
    }

    // Access check
    if (!isAdmin && ticket.clientId !== userId && ticket.agentId !== userId) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    // ─── assign: ADMIN/MANAGER sets agentId, status -> OPEN ───
    if (action === "assign") {
      if (!(await can(userId, role, PERMISSIONS.TICKETS_ASSIGN))) {
        return NextResponse.json({ error: "غير مصرح بتعيين الموظف" }, { status: 403 });
      }
      if (!agentId) {
        return NextResponse.json({ error: "يجب تحديد الموظف المسؤول" }, { status: 400 });
      }

      const updated = await prisma.ticket.update({
        where: { id },
        data: { agentId, status: "OPEN" },
      });

      await prisma.notification.create({
        data: {
          userId: agentId,
          type: "TASK_UPDATE" as const,
          message: `تم تعيينك على تذكرة: ${ticket.subject} (${ticket.ticketNumber})`,
          link: `/dashboard/tickets`,
        },
      });

      createAuditLog({
        userId: session.user.id, userName: session.user.name || undefined, userRole: role,
        action: "TICKET_ASSIGNED", module: AuditModule.TICKETS,
        entityType: "Ticket", entityId: id, entityName: ticket.subject,
        after: { agentId, status: "OPEN" },
      });

      return NextResponse.json(updated);
    }

    // ─── start: agent sets status -> IN_PROGRESS ───
    if (action === "start") {
      if (ticket.agentId !== userId && !isAdmin) {
        return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
      }

      const updated = await prisma.ticket.update({
        where: { id },
        data: { status: "IN_PROGRESS" },
      });

      await prisma.notification.create({
        data: {
          userId: ticket.clientId,
          type: "TASK_UPDATE" as const,
          message: `جاري العمل على تذكرتك: ${ticket.subject}`,
          link: `/dashboard/tickets`,
        },
      });

      return NextResponse.json(updated);
    }

    // ─── pending_client: agent sets status -> PENDING_CLIENT ───
    if (action === "pending_client") {
      if (ticket.agentId !== userId && !isAdmin) {
        return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
      }

      const updated = await prisma.ticket.update({
        where: { id },
        data: { status: "PENDING_CLIENT" },
      });

      await prisma.notification.create({
        data: {
          userId: ticket.clientId,
          type: "TASK_UPDATE" as const,
          message: `تذكرتك بانتظار ردك: ${ticket.subject}`,
          link: `/dashboard/tickets`,
        },
      });

      return NextResponse.json(updated);
    }

    // ─── resolve: agent sets status -> RESOLVED ───
    if (action === "resolve") {
      if (ticket.agentId !== userId && !isAdmin) {
        return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
      }

      const updated = await prisma.ticket.update({
        where: { id },
        data: { status: "RESOLVED", resolvedAt: new Date() },
      });

      await prisma.notification.create({
        data: {
          userId: ticket.clientId,
          type: "TASK_UPDATE" as const,
          message: `تم حل تذكرتك: ${ticket.subject}`,
          link: `/dashboard/tickets`,
        },
      });

      createAuditLog({
        userId: session.user.id, userName: session.user.name || undefined, userRole: role,
        action: "TICKET_RESOLVED", module: AuditModule.TICKETS,
        entityType: "Ticket", entityId: id, entityName: ticket.subject,
        before: { status: ticket.status }, after: { status: "RESOLVED" },
      });

      return NextResponse.json(updated);
    }

    // ─── close: ADMIN/MANAGER or client, status -> CLOSED ───
    if (action === "close") {
      if (!isAdmin && ticket.clientId !== userId) {
        return NextResponse.json({ error: "غير مصرح بإغلاق التذكرة" }, { status: 403 });
      }

      const updated = await prisma.ticket.update({
        where: { id },
        data: { status: "CLOSED", closedAt: new Date() },
      });

      // Notify the other party
      const notifyUserId = ticket.clientId === userId ? ticket.agentId : ticket.clientId;
      if (notifyUserId) {
        await prisma.notification.create({
          data: {
            userId: notifyUserId,
            type: "TASK_UPDATE" as const,
            message: `تم إغلاق التذكرة: ${ticket.subject}`,
            link: `/dashboard/tickets`,
          },
        });
      }

      createAuditLog({
        userId: session.user.id, userName: session.user.name || undefined, userRole: role,
        action: "TICKET_CLOSED", module: AuditModule.TICKETS,
        entityType: "Ticket", entityId: id, entityName: ticket.subject,
        before: { status: ticket.status }, after: { status: "CLOSED" },
      });

      return NextResponse.json(updated);
    }

    // ─── reopen: client reopens RESOLVED ticket -> OPEN ───
    if (action === "reopen") {
      if (ticket.clientId !== userId) {
        return NextResponse.json({ error: "غير مصرح بإعادة فتح التذكرة" }, { status: 403 });
      }
      if (ticket.status !== "RESOLVED") {
        return NextResponse.json({ error: "لا يمكن إعادة فتح تذكرة غير محلولة" }, { status: 400 });
      }

      const updated = await prisma.ticket.update({
        where: { id },
        data: { status: "OPEN", resolvedAt: null },
      });

      if (ticket.agentId) {
        await prisma.notification.create({
          data: {
            userId: ticket.agentId,
            type: "TASK_UPDATE" as const,
            message: `أعاد العميل فتح التذكرة: ${ticket.subject}`,
            link: `/dashboard/tickets`,
          },
        });
      }

      return NextResponse.json(updated);
    }

    // ─── reply: add a TicketMessage ───
    if (action === "reply") {
      if (!messageBody) {
        return NextResponse.json({ error: "محتوى الرسالة مطلوب" }, { status: 400 });
      }

      const isAgent = ticket.agentId === userId || isAdmin;
      const internalFlag = isAgent && isInternal ? true : false;

      // Auto-set status if agent replies and status is NEW
      let statusUpdate = {};
      if (isAgent && ticket.status === "NEW") {
        statusUpdate = { status: "OPEN" };
      }

      const [message] = await prisma.$transaction([
        prisma.ticketMessage.create({
          data: {
            ticketId: id,
            senderId: userId,
            body: messageBody,
            isInternal: internalFlag,
          },
          include: {
            sender: { select: { id: true, name: true, role: true } },
          },
        }),
        prisma.ticket.update({
          where: { id },
          data: { ...statusUpdate, updatedAt: new Date() },
        }),
      ]);

      // Notify the other party
      if (!internalFlag) {
        const notifyUserId = ticket.clientId === userId ? ticket.agentId : ticket.clientId;
        if (notifyUserId) {
          await prisma.notification.create({
            data: {
              userId: notifyUserId,
              type: "NEW_MESSAGE" as const,
              message: `رسالة جديدة في التذكرة: ${ticket.subject}`,
              link: `/dashboard/tickets`,
            },
          });
        }
      }

      return NextResponse.json(message);
    }

    // ─── update_priority: ADMIN/MANAGER updates priority ───
    if (action === "update_priority") {
      if (!isAdmin) {
        return NextResponse.json({ error: "غير مصرح بتغيير الأولوية" }, { status: 403 });
      }
      if (!priority) {
        return NextResponse.json({ error: "يجب تحديد الأولوية" }, { status: 400 });
      }

      const updated = await prisma.ticket.update({
        where: { id },
        data: { priority, ...(category ? { category } : {}) },
      });

      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: "إجراء غير معروف" }, { status: 400 });
  } catch (error) {
    console.error("Error updating ticket:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

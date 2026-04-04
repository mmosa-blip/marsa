import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const { id } = await params;
    const reqBody = await request.json();
    const { body, isInternal, attachments } = reqBody;

    if (!body) {
      return NextResponse.json({ error: "محتوى الرسالة مطلوب" }, { status: 400 });
    }

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

    // Access check: client, assigned agent, admin/manager
    if (!isAdmin && ticket.clientId !== userId && ticket.agentId !== userId) {
      return NextResponse.json({ error: "غير مصرح بالرد على هذه التذكرة" }, { status: 403 });
    }

    const isAgent = ticket.agentId === userId || isAdmin;
    const isClient = ticket.clientId === userId;
    const internalFlag = isAgent && isInternal ? true : false;

    // Determine status update
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const statusUpdate: any = {};
    if (isClient && ticket.status === "RESOLVED") {
      // Client sends message on resolved ticket -> reopen
      statusUpdate.status = "OPEN";
      statusUpdate.resolvedAt = null;
    } else if (isAgent && ticket.status === "NEW") {
      // Agent sends message on new ticket -> open
      statusUpdate.status = "OPEN";
    }

    const message = await prisma.ticketMessage.create({
      data: {
        ticketId: id,
        senderId: userId,
        body,
        isInternal: internalFlag,
        ...(attachments && Array.isArray(attachments) && attachments.length > 0
          ? {
              attachments: {
                create: attachments.map((att: { url: string; filename: string }) => ({
                  ticketId: id,
                  url: att.url,
                  filename: att.filename,
                })),
              },
            }
          : {}),
      },
      include: {
        sender: { select: { id: true, name: true, role: true } },
        attachments: true,
      },
    });

    // Update ticket timestamp and status
    await prisma.ticket.update({
      where: { id },
      data: { ...statusUpdate, updatedAt: new Date() },
    });

    // Notify the other party (skip for internal messages)
    if (!internalFlag) {
      const notifyUserId = isClient ? ticket.agentId : ticket.clientId;
      if (notifyUserId) {
        await prisma.notification.create({
          data: {
            userId: notifyUserId,
            type: "NEW_MESSAGE" as const,
            message: `رسالة جديدة في التذكرة: ${ticket.subject} (${ticket.ticketNumber})`,
            link: `/dashboard/tickets`,
          },
        });
      }
    }

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    console.error("Error creating ticket message:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

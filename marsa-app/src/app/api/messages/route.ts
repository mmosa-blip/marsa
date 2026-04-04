import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import { pusherServer } from "@/lib/pusher";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const userId = session.user.id;
    const senderName = session.user.name || "مستخدم";
    const body = await request.json();
    const { conversationId, body: messageBody, image } = body;

    if (!conversationId) {
      return NextResponse.json(
        { error: "معرف المحادثة مطلوب" },
        { status: 400 }
      );
    }

    if (!messageBody && !image) {
      return NextResponse.json(
        { error: "يرجى إدخال نص الرسالة أو إرفاق صورة" },
        { status: 400 }
      );
    }

    // Verify sender is a member of the conversation
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        users: { some: { id: userId } },
      },
      include: {
        users: { select: { id: true, name: true } },
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: "المحادثة غير موجودة أو ليس لديك صلاحية الوصول" },
        { status: 404 }
      );
    }

    // Create message, update conversation lastMessageAt, and mark as seen by sender
    const message = await prisma.message.create({
      data: {
        body: messageBody || null,
        image: image || null,
        senderId: userId,
        conversationId,
        seen: {
          connect: { id: userId },
        },
      },
      include: {
        sender: { select: { id: true, name: true, role: true } },
        seen: { select: { id: true, name: true } },
      },
    });

    // Update conversation lastMessageAt
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    });

    // Trigger real-time message via Pusher
    try {
      await pusherServer.trigger(
        `private-conversation-${conversationId}`,
        "new-message",
        message
      );

      // Notify all other conversation users about the update
      for (const user of conversation.users) {
        if (user.id !== userId) {
          await pusherServer.trigger(
            `private-user-${user.id}`,
            "conversation-update",
            {
              conversationId,
              lastMessage: message,
            }
          );
        }
      }
    } catch (error) {
      console.error("Pusher trigger error (messages):", error);
    }

    // Send notifications to all other users in the conversation
    const otherUsers = conversation.users.filter((u) => u.id !== userId);
    await Promise.all(
      otherUsers.map((user) =>
        createNotification({
          userId: user.id,
          type: "NEW_MESSAGE",
          message: `رسالة جديدة من ${senderName}`,
          link: "/dashboard/chat",
        })
      )
    );

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    console.error("Error sending message:", error);
    return NextResponse.json(
      { error: "حدث خطأ في إرسال الرسالة" },
      { status: 500 }
    );
  }
}

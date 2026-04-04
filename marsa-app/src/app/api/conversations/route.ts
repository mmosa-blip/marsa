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

    const userId = session.user.id;

    const conversations = await prisma.conversation.findMany({
      where: { users: { some: { id: userId } } },
      include: {
        users: {
          select: { id: true, name: true, email: true, role: true },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            sender: { select: { id: true, name: true } },
          },
        },
        project: { select: { id: true, name: true } },
      },
      orderBy: { lastMessageAt: "desc" },
    });

    // Calculate unread count for each conversation
    const result = await Promise.all(
      conversations.map(async (conv) => {
        const unreadCount = await prisma.message.count({
          where: {
            conversationId: conv.id,
            senderId: { not: userId },
            NOT: { seen: { some: { id: userId } } },
          },
        });

        // For 1-on-1 conversations, use the other user's name
        let displayName = conv.name;
        if (!conv.isGroup) {
          const otherUser = conv.users.find((u) => u.id !== userId);
          if (otherUser) {
            displayName = otherUser.name;
          }
        }

        return { ...conv, unreadCount, displayName };
      })
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching conversations:", error);
    return NextResponse.json({ error: "حدث خطأ في جلب المحادثات" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const currentUserId = session.user.id;
    const body = await request.json();
    const { userId, userIds, name, isGroup, projectId } = body;

    // 1-on-1 conversation
    if (!isGroup && userId) {
      // Check if conversation already exists between these two users
      const existingConversation = await prisma.conversation.findFirst({
        where: {
          isGroup: false,
          AND: [
            { users: { some: { id: currentUserId } } },
            { users: { some: { id: userId } } },
          ],
        },
        include: {
          users: {
            select: { id: true, name: true, email: true, role: true },
          },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            include: {
              sender: { select: { id: true, name: true } },
            },
          },
          project: { select: { id: true, name: true } },
        },
      });

      if (existingConversation) {
        return NextResponse.json(existingConversation);
      }

      // Create new 1-on-1 conversation
      const conversation = await prisma.conversation.create({
        data: {
          isGroup: false,
          users: {
            connect: [{ id: currentUserId }, { id: userId }],
          },
        },
        include: {
          users: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      });

      return NextResponse.json(conversation, { status: 201 });
    }

    // Group conversation
    if (isGroup && userIds && Array.isArray(userIds)) {
      if (!name) {
        return NextResponse.json(
          { error: "اسم المجموعة مطلوب" },
          { status: 400 }
        );
      }

      // Ensure current user is included
      const allUserIds = Array.from(new Set([currentUserId, ...userIds]));

      const conversationData: {
        name: string;
        isGroup: boolean;
        users: { connect: { id: string }[] };
        projectId?: string;
      } = {
        name,
        isGroup: true,
        users: {
          connect: allUserIds.map((id: string) => ({ id })),
        },
      };

      if (projectId) {
        conversationData.projectId = projectId;
      }

      const conversation = await prisma.conversation.create({
        data: conversationData,
        include: {
          users: {
            select: { id: true, name: true, email: true, role: true },
          },
          project: { select: { id: true, name: true } },
        },
      });

      return NextResponse.json(conversation, { status: 201 });
    }

    return NextResponse.json(
      { error: "بيانات غير صالحة. يرجى تحديد userId أو userIds مع isGroup" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error creating conversation:", error);
    return NextResponse.json({ error: "حدث خطأ في إنشاء المحادثة" }, { status: 500 });
  }
}

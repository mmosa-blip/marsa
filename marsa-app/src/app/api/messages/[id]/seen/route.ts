import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const { id: messageId } = await params;
    const userId = session.user.id;

    // Verify message exists and user is in the conversation
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: {
        conversation: {
          include: {
            users: { select: { id: true } },
          },
        },
      },
    });

    if (!message) {
      return NextResponse.json(
        { error: "الرسالة غير موجودة" },
        { status: 404 }
      );
    }

    const isMember = message.conversation.users.some((u) => u.id === userId);
    if (!isMember) {
      return NextResponse.json(
        { error: "ليس لديك صلاحية الوصول لهذه المحادثة" },
        { status: 403 }
      );
    }

    // Mark message as seen by current user
    await prisma.message.update({
      where: { id: messageId },
      data: {
        seen: { connect: { id: userId } },
      },
    });

    // Trigger real-time seen status via Pusher
    try {
      await pusherServer.trigger(
        `private-conversation-${message.conversationId}`,
        "message-seen",
        {
          messageId,
          seenBy: userId,
        }
      );
    } catch (error) {
      console.error("Pusher trigger error (message-seen):", error);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error marking message as seen:", error);
    return NextResponse.json(
      { error: "حدث خطأ في تحديث حالة القراءة" },
      { status: 500 }
    );
  }
}

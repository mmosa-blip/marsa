import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pusherServer } from "@/lib/pusher";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await request.text();
    const params = new URLSearchParams(body);
    const socketId = params.get("socket_id");
    const channelName = params.get("channel_name");

    if (!socketId || !channelName) {
      return NextResponse.json(
        { error: "socket_id and channel_name are required" },
        { status: 400 }
      );
    }

    // Verify user has access to the channel
    if (channelName.startsWith("private-user-")) {
      // User can only subscribe to their own channel
      const channelUserId = channelName.replace("private-user-", "");
      if (channelUserId !== userId) {
        return NextResponse.json(
          { error: "غير مصرح بالوصول لهذه القناة" },
          { status: 403 }
        );
      }
    } else if (channelName.startsWith("private-conversation-")) {
      // User must be a member of the conversation
      const conversationId = channelName.replace("private-conversation-", "");
      const conversation = await prisma.conversation.findFirst({
        where: {
          id: conversationId,
          users: { some: { id: userId } },
        },
      });
      if (!conversation) {
        return NextResponse.json(
          { error: "غير مصرح بالوصول لهذه المحادثة" },
          { status: 403 }
        );
      }
    } else {
      return NextResponse.json(
        { error: "قناة غير معروفة" },
        { status: 403 }
      );
    }

    const authResponse = pusherServer.authorizeChannel(socketId, channelName);
    return NextResponse.json(authResponse);
  } catch (error) {
    console.error("Pusher auth error:", error);
    return NextResponse.json(
      { error: "حدث خطأ في المصادقة" },
      { status: 500 }
    );
  }
}

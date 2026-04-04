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

    // Get all conversation IDs where user is a member
    const conversations = await prisma.conversation.findMany({
      where: { users: { some: { id: userId } } },
      select: { id: true },
    });

    const conversationIds = conversations.map((c) => c.id);

    // Count all unread messages across all conversations
    const count = await prisma.message.count({
      where: {
        conversationId: { in: conversationIds },
        senderId: { not: userId },
        NOT: { seen: { some: { id: userId } } },
      },
    });

    return NextResponse.json({ count });
  } catch (error) {
    console.error("Error fetching unread count:", error);
    return NextResponse.json(
      { error: "حدث خطأ في جلب عدد الرسائل غير المقروءة" },
      { status: 500 }
    );
  }
}

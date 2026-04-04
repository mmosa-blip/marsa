import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const { id: conversationId } = await params;
    const userId = session.user.id;

    // Verify user is a member of this conversation
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        users: { some: { id: userId } },
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: "المحادثة غير موجودة أو ليس لديك صلاحية الوصول" },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get("cursor");
    const limit = parseInt(searchParams.get("limit") || "30", 10);

    const messages = await prisma.message.findMany({
      where: {
        conversationId,
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        sender: { select: { id: true, name: true, role: true } },
        seen: { select: { id: true, name: true } },
      },
    });

    const nextCursor =
      messages.length === limit
        ? messages[messages.length - 1].createdAt.toISOString()
        : null;

    return NextResponse.json({ messages, nextCursor });
  } catch (error) {
    console.error("Error fetching messages:", error);
    return NextResponse.json(
      { error: "حدث خطأ في جلب الرسائل" },
      { status: 500 }
    );
  }
}

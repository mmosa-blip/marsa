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
    const status = searchParams.get("status");
    const isAdmin = ["ADMIN", "MANAGER"].includes(session.user.role);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (status) {
      const statuses = status.split(",");
      where.status = statuses.length > 1 ? { in: statuses } : status;
    }

    // Non-admin users can only see transfers where they are requester or target
    if (!isAdmin) {
      where.OR = [
        { requesterId: session.user.id },
        { targetUserId: session.user.id },
      ];
    }

    const transfers = await prisma.taskTransferRequest.findMany({
      where,
      include: {
        task: true,
        requester: {
          select: { id: true, name: true, email: true },
        },
        targetUser: {
          select: { id: true, name: true, email: true },
        },
        reviewedBy: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(transfers);
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

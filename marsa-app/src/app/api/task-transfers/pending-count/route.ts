import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ count: 0 });
    }

    const userId = session.user.id;
    const role = session.user.role;
    const isAdmin = role === "ADMIN" || role === "MANAGER";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = isAdmin
      ? { status: "PENDING_ADMIN" }
      : { status: "PENDING_TARGET", targetUserId: userId };

    const count = await prisma.taskTransferRequest.count({ where });

    return NextResponse.json({ count });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}

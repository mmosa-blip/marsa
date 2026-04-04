import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET — list soft-deleted users (recycle bin, 30-day window)
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const deletedUsers = await prisma.user.findMany({
      where: {
        deletedAt: { not: null, gte: thirtyDaysAgo },
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        deletedAt: true,
      },
      orderBy: { deletedAt: "desc" },
    });

    return NextResponse.json(deletedUsers);
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

// POST — restore a soft-deleted user
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const { userId } = await request.json();
    if (!userId) {
      return NextResponse.json({ error: "معرف المستخدم مطلوب" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.deletedAt) {
      return NextResponse.json({ error: "المستخدم غير موجود في سلة المحذوفات" }, { status: 404 });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { deletedAt: null, isActive: true },
    });

    return NextResponse.json({ message: "تم استعادة المستخدم بنجاح" });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

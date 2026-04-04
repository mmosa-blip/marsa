import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const policies = await prisma.systemPolicy.findMany({
      where: { isPublished: true },
      include: {
        updatedBy: { select: { name: true } },
        notifications: {
          where: { userId: session.user.id, readAt: null },
          select: { id: true },
        },
      },
      orderBy: { order: "asc" },
    });

    return NextResponse.json(policies);
  } catch (error) {
    console.error("Error fetching policies:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "للأدمن فقط" }, { status: 403 });
    }

    const { title, content, icon, order, slug } = await request.json();
    if (!title || !content || !slug) {
      return NextResponse.json({ error: "العنوان والمحتوى والرابط مطلوبة" }, { status: 400 });
    }

    const policy = await prisma.systemPolicy.create({
      data: {
        title,
        content,
        icon: icon || null,
        slug,
        order: order || 0,
        updatedById: session.user.id,
      },
    });

    return NextResponse.json(policy, { status: 201 });
  } catch (error) {
    console.error("Error creating policy:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

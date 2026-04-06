import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get("departmentId");

    const where: Record<string, unknown> = { isActive: true };
    if (departmentId) where.departmentId = departmentId;

    const groups = await prisma.documentGroup.findMany({
      where,
      include: {
        docTypes: {
          where: { isActive: true },
          orderBy: { displayOrder: "asc" },
        },
        _count: { select: { docTypes: true } },
      },
      orderBy: { displayOrder: "asc" },
    });
    return NextResponse.json(groups);
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, displayOrder, departmentId } = body;

    if (!name?.trim()) return NextResponse.json({ error: "الاسم مطلوب" }, { status: 400 });
    if (!departmentId) return NextResponse.json({ error: "القسم مطلوب" }, { status: 400 });

    const group = await prisma.documentGroup.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        displayOrder: parseInt(String(displayOrder || 0)),
        departmentId,
      },
    });
    return NextResponse.json(group, { status: 201 });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const { id } = await params;

    const template = await prisma.contractTemplate.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true } },
        _count: { select: { contracts: true } },
      },
    });

    if (!template) {
      return NextResponse.json({ error: "القالب غير موجود" }, { status: 404 });
    }

    return NextResponse.json(template);
  } catch (error) {
    console.error("Error fetching contract template:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !["ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { title, content, description, isActive, marginTop, marginBottom, marginLeft, marginRight, fontSize, textAlign, letterheadImage } = body;

    if (title) {
      const existingCt = await prisma.contractTemplate.findFirst({
        where: { title, id: { not: id } },
      });
      if (existingCt) {
        return NextResponse.json({ error: "قالب عقد بهذا الاسم موجود بالفعل" }, { status: 409 });
      }
    }

    const template = await prisma.contractTemplate.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(content !== undefined && { content }),
        ...(description !== undefined && { description }),
        ...(isActive !== undefined && { isActive }),
        ...(marginTop !== undefined && { marginTop }),
        ...(marginBottom !== undefined && { marginBottom }),
        ...(marginLeft !== undefined && { marginLeft }),
        ...(marginRight !== undefined && { marginRight }),
        ...(fontSize !== undefined && { fontSize }),
        ...(textAlign !== undefined && { textAlign }),
        ...(letterheadImage !== undefined && { letterheadImage }),
      },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(template);
  } catch (error) {
    console.error("Error updating contract template:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !["ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const { id } = await params;

    await prisma.contractTemplate.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ message: "تم حذف القالب" });
  } catch (error) {
    console.error("Error deleting contract template:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

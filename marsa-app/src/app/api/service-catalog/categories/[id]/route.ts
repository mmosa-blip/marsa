import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { error: "يجب تسجيل الدخول أولاً" },
        { status: 401 }
      );
    }

    if (!["ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "غير مصرح لك بتعديل التصنيفات" },
        { status: 403 }
      );
    }

    const { id } = await params;

    const existing = await prisma.serviceCategory.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "التصنيف غير موجود" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { name, description, icon, color, isActive, isPublic, sortOrder } = body;

    if (name) {
      const existingCat = await prisma.serviceCategory.findFirst({
        where: { name, id: { not: id } },
      });
      if (existingCat) {
        return NextResponse.json({ error: "تصنيف بهذا الاسم موجود بالفعل" }, { status: 409 });
      }
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (description !== undefined) data.description = description;
    if (icon !== undefined) data.icon = icon;
    if (color !== undefined) data.color = color;
    if (isActive !== undefined) data.isActive = isActive;
    if (isPublic !== undefined) data.isPublic = isPublic;
    if (sortOrder !== undefined) data.sortOrder = parseInt(sortOrder);

    const category = await prisma.serviceCategory.update({
      where: { id },
      data,
    });

    return NextResponse.json(category);
  } catch (error) {
    console.error("Error updating service category:", error);
    return NextResponse.json(
      { error: "حدث خطأ في تحديث التصنيف" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { error: "يجب تسجيل الدخول أولاً" },
        { status: 401 }
      );
    }

    if (!["ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "غير مصرح لك بحذف التصنيفات" },
        { status: 403 }
      );
    }

    const { id } = await params;

    const existing = await prisma.serviceCategory.findUnique({
      where: { id },
      include: {
        _count: {
          select: { templates: true },
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "التصنيف غير موجود" },
        { status: 404 }
      );
    }

    if (existing._count.templates > 0) {
      return NextResponse.json(
        { error: "لا يمكن حذف التصنيف لأنه يحتوي على قوالب خدمات مرتبطة به" },
        { status: 400 }
      );
    }

    await prisma.serviceCategory.delete({
      where: { id },
    });

    return NextResponse.json({ message: "تم حذف التصنيف بنجاح" });
  } catch (error) {
    console.error("Error deleting service category:", error);
    return NextResponse.json(
      { error: "حدث خطأ في حذف التصنيف" },
      { status: 500 }
    );
  }
}

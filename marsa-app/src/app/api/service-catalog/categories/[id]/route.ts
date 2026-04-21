import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["ADMIN", "MANAGER"]);

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
    if (error instanceof Response) return error;
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
    await requireRole(["ADMIN", "MANAGER"]);

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
    if (error instanceof Response) return error;
    console.error("Error deleting service category:", error);
    return NextResponse.json(
      { error: "حدث خطأ في حذف التصنيف" },
      { status: 500 }
    );
  }
}

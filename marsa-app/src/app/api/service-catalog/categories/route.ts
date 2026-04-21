import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";

export async function GET() {
  try {
    const session = await requireRole(["ADMIN", "MANAGER", "CLIENT", "EXECUTOR", "BRANCH_MANAGER"]);

    const categories = await prisma.serviceCategory.findMany({
      where: {
        ...(session.user.role === "CLIENT" ? { isPublic: true } : {}),
      },
      orderBy: { sortOrder: "asc" },
      include: {
        _count: {
          select: {
            templates: true,
          },
        },
        templates: {
          select: {
            _count: {
              select: {
                taskTemplates: true,
              },
            },
          },
        },
      },
    });

    const result = categories.map((category) => {
      const taskTemplatesCount = category.templates.reduce(
        (sum, template) => sum + template._count.taskTemplates,
        0
      );

      return {
        ...category,
        _count: {
          templates: category._count.templates,
          taskTemplates: taskTemplatesCount,
        },
        templates: undefined,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error fetching service categories:", error);
    return NextResponse.json(
      { error: "حدث خطأ في جلب تصنيفات الخدمات" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await requireRole(["ADMIN", "MANAGER"]);

    const body = await request.json();
    const { name, description, icon, color, sortOrder } = body;

    if (!name) {
      return NextResponse.json(
        { error: "اسم التصنيف مطلوب" },
        { status: 400 }
      );
    }

    const existingCat = await prisma.serviceCategory.findFirst({ where: { name } });
    if (existingCat) {
      return NextResponse.json({ error: "تصنيف بهذا الاسم موجود بالفعل" }, { status: 409 });
    }

    const category = await prisma.serviceCategory.create({
      data: {
        name,
        description: description || null,
        icon: icon || null,
        color: color || null,
        sortOrder: sortOrder ? parseInt(sortOrder) : 0,
      },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error creating service category:", error);
    return NextResponse.json(
      { error: "حدث خطأ في إنشاء التصنيف" },
      { status: 500 }
    );
  }
}

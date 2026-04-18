import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { error: "يجب تسجيل الدخول أولاً" },
        { status: 401 }
      );
    }

    if (!["ADMIN", "MANAGER", "CLIENT", "EXECUTOR", "BRANCH_MANAGER"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "غير مصرح لك بالوصول إلى هذه البيانات" },
        { status: 403 }
      );
    }

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
    console.error("Error fetching service categories:", error);
    return NextResponse.json(
      { error: "حدث خطأ في جلب تصنيفات الخدمات" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
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
        { error: "غير مصرح لك بإنشاء تصنيفات" },
        { status: 403 }
      );
    }

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
    console.error("Error creating service category:", error);
    return NextResponse.json(
      { error: "حدث خطأ في إنشاء التصنيف" },
      { status: 500 }
    );
  }
}

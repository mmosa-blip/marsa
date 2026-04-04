import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: "غير مصرح لك بالوصول" },
        { status: 401 }
      );
    }

    if (!["ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "ليس لديك صلاحية للوصول إلى هذا المورد" },
        { status: 403 }
      );
    }

    const { id } = await params;

    const serviceTemplate = await prisma.serviceTemplate.findUnique({
      where: { id },
    });

    if (!serviceTemplate) {
      return NextResponse.json(
        { error: "قالب الخدمة غير موجود" },
        { status: 404 }
      );
    }

    const taskTemplates = await prisma.taskTemplate.findMany({
      where: { serviceTemplateId: id },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json(taskTemplates);
  } catch (error) {
    console.error("خطأ في جلب قوالب المهام:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء جلب قوالب المهام" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: "غير مصرح لك بالوصول" },
        { status: 401 }
      );
    }

    if (!["ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "ليس لديك صلاحية للوصول إلى هذا المورد" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { name, description, defaultDuration, sortOrder, isRequired, executionMode, sameDay } = body;

    if (!name) {
      return NextResponse.json(
        { error: "اسم قالب المهمة مطلوب" },
        { status: 400 }
      );
    }

    const serviceTemplate = await prisma.serviceTemplate.findUnique({
      where: { id },
    });

    if (!serviceTemplate) {
      return NextResponse.json(
        { error: "قالب الخدمة غير موجود" },
        { status: 404 }
      );
    }

    const taskTemplate = await prisma.taskTemplate.create({
      data: {
        name,
        description,
        defaultDuration,
        sortOrder,
        isRequired,
        executionMode: executionMode || "SEQUENTIAL",
        sameDay: sameDay || false,
        serviceTemplateId: id,
      },
    });

    return NextResponse.json(taskTemplate, { status: 201 });
  } catch (error) {
    console.error("خطأ في إنشاء قالب المهمة:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء إنشاء قالب المهمة" },
      { status: 500 }
    );
  }
}

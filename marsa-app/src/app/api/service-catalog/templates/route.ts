import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: "غير مصرح لك بالوصول" },
        { status: 401 }
      );
    }

    if (!["ADMIN", "MANAGER", "CLIENT"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "ليس لديك صلاحية للوصول إلى هذا المورد" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get("categoryId");

    const where: Record<string, unknown> = {};
    if (categoryId) where.categoryId = categoryId;
    if (session.user.role === "CLIENT") {
      where.category = { isPublic: true };
    }

    const templates = await prisma.serviceTemplate.findMany({
      where,
      include: {
        category: true,
        department: { select: { id: true, name: true, nameEn: true, color: true } },
        _count: {
          select: {
            taskTemplates: true,
            qualifiedEmployees: true,
          },
        },
      },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json(templates);
  } catch (error) {
    console.error("خطأ في جلب قوالب الخدمات:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء جلب قوالب الخدمات" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { name, description, categoryId, defaultPrice, defaultDuration, workflowType, sortOrder, departmentId } = body;

    if (!name || !categoryId) {
      return NextResponse.json(
        { error: "اسم القالب وتصنيف الخدمة مطلوبان" },
        { status: 400 }
      );
    }

    const existing = await prisma.serviceTemplate.findFirst({
      where: { name, categoryId },
    });
    if (existing) {
      return NextResponse.json(
        { error: "توجد خدمة بهذا الاسم مسبقاً في نفس التصنيف." },
        { status: 400 }
      );
    }

    if (workflowType && !["SEQUENTIAL", "INDEPENDENT"].includes(workflowType)) {
      return NextResponse.json(
        { error: "نوع سير العمل غير صالح. القيم المسموحة: SEQUENTIAL أو INDEPENDENT" },
        { status: 400 }
      );
    }

    const { tasks } = body as {
      tasks?: { name: string; description?: string; defaultDuration?: number; isRequired?: boolean; dependsOnIndex?: number | null; executionMode?: string; sameDay?: boolean }[];
    };

    const result = await prisma.$transaction(async (tx) => {
      const template = await tx.serviceTemplate.create({
        data: {
          name,
          description,
          categoryId,
          defaultPrice,
          defaultDuration,
          workflowType,
          sortOrder,
          departmentId: departmentId || null,
        },
      });

      if (tasks && Array.isArray(tasks) && tasks.length > 0) {
        // Create tasks one by one to get IDs for dependency linking
        const createdTaskIds: string[] = [];

        for (let i = 0; i < tasks.length; i++) {
          const task = tasks[i];
          const dependsOnId =
            task.dependsOnIndex !== null &&
            task.dependsOnIndex !== undefined &&
            task.dependsOnIndex >= 0 &&
            task.dependsOnIndex < createdTaskIds.length
              ? createdTaskIds[task.dependsOnIndex]
              : null;

          const created = await tx.taskTemplate.create({
            data: {
              name: task.name,
              description: task.description || null,
              defaultDuration: task.defaultDuration || 1,
              isRequired: task.isRequired !== undefined ? task.isRequired : true,
              sortOrder: i,
              executionMode: (task.executionMode as "SEQUENTIAL" | "PARALLEL" | "INDEPENDENT") || "SEQUENTIAL",
              sameDay: task.sameDay || false,
              serviceTemplateId: template.id,
              dependsOnId,
            },
          });

          createdTaskIds.push(created.id);
        }
      }

      return tx.serviceTemplate.findUnique({
        where: { id: template.id },
        include: {
          category: true,
          _count: {
            select: {
              taskTemplates: true,
              qualifiedEmployees: true,
            },
          },
        },
      });
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("خطأ في إنشاء قالب الخدمة:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء إنشاء قالب الخدمة" },
      { status: 500 }
    );
  }
}

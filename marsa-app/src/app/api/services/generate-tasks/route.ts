import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (
      !session ||
      !["ADMIN", "MANAGER", "EXECUTOR"].includes(session.user.role)
    ) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const body = await request.json();
    const { serviceTemplateId, clientId, projectId } = body;

    if (!serviceTemplateId || !clientId) {
      return NextResponse.json(
        { error: "معرّف القالب ومعرّف العميل مطلوبان" },
        { status: 400 }
      );
    }

    // 1. جلب قالب الخدمة مع القوالب الفرعية والموظفين المؤهلين
    const template = await prisma.serviceTemplate.findUnique({
      where: { id: serviceTemplateId },
      include: {
        category: true,
        taskTemplates: { orderBy: { sortOrder: "asc" } },
        qualifiedEmployees: {
          include: { user: true },
        },
      },
    });

    // 2. إذا لم يتم العثور على القالب
    if (!template) {
      return NextResponse.json(
        { error: "قالب الخدمة غير موجود" },
        { status: 404 }
      );
    }

    const employees = template.qualifiedEmployees;
    const taskTemplates = template.taskTemplates;

    // حساب المدة الإجمالية من مجموع مدد المهام أو المدة الافتراضية
    const totalDuration =
      template.defaultDuration ??
      taskTemplates.reduce((sum, t) => sum + t.defaultDuration, 0);

    // 4. إنشاء مشروع جديد إذا لم يتم تمرير projectId
    let finalProjectId = projectId;
    if (!finalProjectId) {
      const now = new Date();
      const endDate = new Date(now);
      endDate.setDate(endDate.getDate() + totalDuration);

      const project = await prisma.project.create({
        data: {
          name: template.name,
          clientId,
          status: "ACTIVE",
          startDate: now,
          endDate,
        },
      });
      finalProjectId = project.id;
    }

    // 3. إنشاء سجل الخدمة
    const service = await prisma.service.create({
      data: {
        name: template.name,
        price: template.defaultPrice,
        duration: template.defaultDuration,
        category: template.category?.name ?? null,
        clientId,
        projectId: finalProjectId,
        status: "IN_PROGRESS",
      },
    });

    // 5. توليد المهام من قوالب المهام
    const now = new Date();
    const tasks = [];
    let currentStart = new Date(now);

    for (let i = 0; i < taskTemplates.length; i++) {
      const tt = taskTemplates[i];

      let startDate: Date;
      if (template.workflowType === "SEQUENTIAL") {
        startDate = new Date(currentStart);
      } else {
        // INDEPENDENT - جميع المهام تبدأ اليوم
        startDate = new Date(now);
      }

      const dueDate = new Date(startDate);
      dueDate.setDate(dueDate.getDate() + tt.defaultDuration);

      // التوزيع الدوري للموظفين
      const assigneeId =
        employees.length > 0
          ? employees[i % employees.length].userId
          : null;

      tasks.push({
        title: tt.name,
        status: "TODO" as const,
        priority: "MEDIUM" as const,
        order: tt.sortOrder,
        dueDate,
        serviceId: service.id,
        projectId: finalProjectId,
        assigneeId,
      });

      // تحديث بداية المهمة التالية في التسلسلي
      if (template.workflowType === "SEQUENTIAL") {
        currentStart = new Date(dueDate);
      }
    }

    // إنشاء جميع المهام دفعة واحدة
    await prisma.task.createMany({ data: tasks });

    // 6. إرجاع الخدمة مع المهام
    const serviceWithTasks = await prisma.service.findUnique({
      where: { id: service.id },
      include: {
        tasks: {
          orderBy: { order: "asc" },
          include: {
            assignee: { select: { id: true, name: true } },
          },
        },
      },
    });

    return NextResponse.json(serviceWithTasks, { status: 201 });
  } catch (error) {
    console.error("Error generating tasks:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء توليد المهام" },
      { status: 500 }
    );
  }
}

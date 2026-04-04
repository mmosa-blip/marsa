import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const body = await request.json();
    const { clientId, serviceTemplateId, notes, contractId } = body;

    if (!clientId || !serviceTemplateId) {
      return NextResponse.json({ error: "العميل والخدمة مطلوبان" }, { status: 400 });
    }

    // Fetch service template with task templates and employees
    const template = await prisma.serviceTemplate.findUnique({
      where: { id: serviceTemplateId },
      include: {
        category: true,
        taskTemplates: { orderBy: { sortOrder: "asc" } },
        qualifiedEmployees: { include: { user: { select: { id: true, name: true } } } },
      },
    });

    if (!template) {
      return NextResponse.json({ error: "الخدمة غير موجودة" }, { status: 404 });
    }

    // Fetch client name
    const client = await prisma.user.findUnique({
      where: { id: clientId },
      select: { name: true },
    });

    if (!client) {
      return NextResponse.json({ error: "العميل غير موجود" }, { status: 404 });
    }

    const now = new Date();
    const totalDuration = template.taskTemplates.reduce((sum, t) => sum + (t.defaultDuration || 1), 0);
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + totalDuration);

    // Create project with service and tasks in a transaction
    const project = await prisma.$transaction(async (tx) => {
      // Create project
      const proj = await tx.project.create({
        data: {
          name: `${template.name} — ${client.name}`,
          description: notes || `خدمة سريعة: ${template.name}`,
          status: "ACTIVE",
          priority: "MEDIUM",
          workflowType: template.workflowType || "SEQUENTIAL",
          totalPrice: template.defaultPrice || 0,
          startDate: now,
          endDate,
          clientId,
          managerId: session.user.id,
          isQuickService: true,
          ...(contractId && { contractId }),
        },
      });

      // Create service instance
      const service = await tx.service.create({
        data: {
          name: template.name,
          category: template.category?.name || "عام",
          price: template.defaultPrice || 0,
          duration: template.defaultDuration || totalDuration,
          status: "ACTIVE",
          projectId: proj.id,
          clientId,
          serviceTemplateId: template.id,
        },
      });

      // Create tasks from templates
      const employees = template.qualifiedEmployees;
      let empIdx = 0;
      let dayOffset = 0;

      for (const taskTpl of template.taskTemplates) {
        const taskStart = new Date(now);
        taskStart.setDate(taskStart.getDate() + dayOffset);
        const taskEnd = new Date(taskStart);
        taskEnd.setDate(taskEnd.getDate() + (taskTpl.defaultDuration || 1));

        const assigneeId = employees.length > 0 ? employees[empIdx % employees.length].userId : null;

        const task = await tx.task.create({
          data: {
            title: taskTpl.name,
            status: "TODO",
            priority: "MEDIUM",
            order: taskTpl.sortOrder,
            dueDate: taskEnd,
            projectId: proj.id,
            serviceId: service.id,
            ...(assigneeId && { assigneeId, assignedAt: now }),
          },
        });

        // Create TaskAssignment if employee assigned
        if (assigneeId) {
          await tx.taskAssignment.upsert({
            where: { taskId_userId: { taskId: task.id, userId: assigneeId } },
            create: { taskId: task.id, userId: assigneeId },
            update: {},
          });
          empIdx++;
        }

        if (template.workflowType === "SEQUENTIAL") {
          dayOffset += taskTpl.defaultDuration || 1;
        }
      }

      return proj;
    });

    // Fetch the created project with relations for response
    const result = await prisma.project.findUnique({
      where: { id: project.id },
      include: {
        client: { select: { name: true } },
        services: true,
        tasks: true,
      },
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Error creating quick service:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pickInvestmentAssignee, isInvestmentDepartment } from "@/lib/investment-assign";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const body = await request.json();
    const { templateId, clientId, name, contractId, departmentId, managerId } = body;
    const resolvedManagerId: string = managerId || session.user.id;

    if (!templateId || !clientId) {
      return NextResponse.json(
        { error: "معرّف القالب ومعرّف العميل مطلوبان" },
        { status: 400 }
      );
    }

    // If contractId provided, extract totalAmount and installments from contract
    let contractTotalPrice: number | null = null;
    let contractInstallments: { title: string; amount: number; dueAfterDays: number | null; order: number }[] = [];
    if (contractId) {
      const contract = await prisma.contract.findUnique({
        where: { id: contractId },
        select: { variables: true, installments: { orderBy: { order: "asc" } } },
      });
      if (contract?.variables) {
        try {
          const vars = JSON.parse(contract.variables);
          const amount = parseFloat(vars.totalAmount || vars.المبلغ_الإجمالي || vars.amount || vars.قيمة_العقد || "0");
          if (amount > 0) contractTotalPrice = amount;
        } catch {}
      }
      if (contract?.installments && contract.installments.length > 0) {
        contractInstallments = contract.installments.map((inst) => ({
          title: inst.title,
          amount: inst.amount,
          dueAfterDays: inst.dueAfterDays,
          order: inst.order,
        }));
      }
    }

    // جلب قالب المشروع مع الخدمات وقوالب المهام والموظفين المؤهلين
    const template = await prisma.projectTemplate.findUnique({
      where: { id: templateId },
      include: {
        services: {
          include: {
            serviceTemplate: {
              include: {
                category: true,
                taskTemplates: { orderBy: { sortOrder: "asc" } },
                qualifiedEmployees: {
                  include: { user: true },
                },
              },
            },
          },
          orderBy: { sortOrder: "asc" },
        },
        milestones: { orderBy: { order: "asc" } },
      },
    });

    if (!template) {
      return NextResponse.json(
        { error: "قالب المشروع غير موجود" },
        { status: 404 }
      );
    }

    if (template.services.length === 0) {
      return NextResponse.json(
        { error: "قالب المشروع لا يحتوي على خدمات" },
        { status: 400 }
      );
    }

    const now = new Date();
    let totalPrice = 0;
    let projectEndDate = new Date(now);

    // حساب تاريخ انتهاء المشروع والسعر الإجمالي
    if (template.workflowType === "SEQUENTIAL") {
      let cumulativeDays = 0;
      for (const pts of template.services) {
        const st = pts.serviceTemplate;
        const serviceDuration =
          st.defaultDuration ??
          st.taskTemplates.reduce((sum, t) => sum + t.defaultDuration, 0);
        cumulativeDays += serviceDuration;
        totalPrice += st.defaultPrice ?? 0;
      }
      projectEndDate.setDate(projectEndDate.getDate() + cumulativeDays);
    } else {
      let maxDuration = 0;
      for (const pts of template.services) {
        const st = pts.serviceTemplate;
        const serviceDuration =
          st.defaultDuration ??
          st.taskTemplates.reduce((sum, t) => sum + t.defaultDuration, 0);
        if (serviceDuration > maxDuration) maxDuration = serviceDuration;
        totalPrice += st.defaultPrice ?? 0;
      }
      projectEndDate.setDate(projectEndDate.getDate() + maxDuration);
    }

    // إنشاء المشروع - use contract price if available
    const finalPrice = contractTotalPrice || totalPrice;

    const project = await prisma.project.create({
      data: {
        name: name || template.name,
        description: template.description,
        workflowType: template.workflowType,
        status: "ACTIVE",
        clientId,
        managerId: resolvedManagerId,
        templateId: template.id,
        totalPrice: finalPrice,
        startDate: now,
        endDate: projectEndDate,
        ...(contractId ? { contractId } : {}),
        ...(departmentId ? { departmentId } : {}),
      },
    });

    const isInvestment = await isInvestmentDepartment(departmentId);

    // متغير لتتبع بداية كل خدمة في الوضع التسلسلي
    let serviceStartDate = new Date(now);

    // إنشاء الخدمات والمهام
    for (const pts of template.services) {
      const st = pts.serviceTemplate;

      const service = await prisma.service.create({
        data: {
          name: st.name,
          description: st.description,
          price: st.defaultPrice,
          duration: st.defaultDuration,
          category: st.category?.name ?? null,
          clientId,
          projectId: project.id,
          status: "IN_PROGRESS",
        },
      });

      // توليد المهام من قوالب المهام (one-by-one to create TaskAssignment records)
      const taskTemplates = st.taskTemplates;
      const employees = st.qualifiedEmployees;
      let currentTaskStart = new Date(
        template.workflowType === "SEQUENTIAL" ? serviceStartDate : now
      );

      for (let i = 0; i < taskTemplates.length; i++) {
        const tt = taskTemplates[i];

        let startDate: Date;
        if (st.workflowType === "SEQUENTIAL") {
          startDate = new Date(currentTaskStart);
        } else {
          startDate = new Date(
            template.workflowType === "SEQUENTIAL" ? serviceStartDate : now
          );
        }

        const dueDate = new Date(startDate);
        dueDate.setDate(dueDate.getDate() + tt.defaultDuration);

        // Investment: date-priority + load balancing. Others: simple round-robin
        let assigneeId: string | null = null;
        if (isInvestment && employees.length > 0) {
          assigneeId = await pickInvestmentAssignee({
            projectId: project.id,
            serviceId: service.id,
            qualifiedEmployeeIds: employees.map((e) => e.userId),
            fallbackIndex: i,
          });
        } else {
          assigneeId =
            employees.length > 0
              ? employees[i % employees.length].userId
              : null;
        }

        const createdTask = await prisma.task.create({
          data: {
            title: tt.name,
            status: "TODO" as const,
            priority: "MEDIUM" as const,
            order: tt.sortOrder,
            dueDate,
            serviceId: service.id,
            projectId: project.id,
            assigneeId,
            assignedAt: assigneeId ? new Date() : null,
            acceptedAt: null,
          },
        });

        // Single-assignee TaskAssignment (for primary assignee only)
        if (assigneeId) {
          await prisma.taskAssignment.upsert({
            where: { taskId_userId: { taskId: createdTask.id, userId: assigneeId } },
            create: { taskId: createdTask.id, userId: assigneeId },
            update: {},
          });
        }

        // تحديث بداية المهمة التالية في الوضع التسلسلي
        if (st.workflowType === "SEQUENTIAL") {
          currentTaskStart = new Date(dueDate);
        }
      }

      // تحديث بداية الخدمة التالية في الوضع التسلسلي على مستوى المشروع
      if (template.workflowType === "SEQUENTIAL") {
        const serviceDuration =
          st.defaultDuration ??
          taskTemplates.reduce((sum, t) => sum + t.defaultDuration, 0);
        serviceStartDate = new Date(serviceStartDate);
        serviceStartDate.setDate(serviceStartDate.getDate() + serviceDuration);
      }
    }

    // Create payment milestones - contract installments take priority over template milestones
    if (contractInstallments.length > 0) {
      for (let ci = 0; ci < contractInstallments.length; ci++) {
        const inst = contractInstallments[ci];
        const dueDate = inst.dueAfterDays
          ? new Date(now.getTime() + inst.dueAfterDays * 24 * 60 * 60 * 1000)
          : projectEndDate;

        const company = await prisma.company.findFirst();
        if (company) {
          const invoiceNumber = `INV-${project.id.slice(-6).toUpperCase()}-CI${ci}`;
          const invoice = await prisma.invoice.create({
            data: {
              invoiceNumber,
              title: inst.title,
              subtotal: inst.amount,
              taxRate: 15,
              taxAmount: inst.amount * 0.15,
              totalAmount: inst.amount * 1.15,
              status: "DRAFT",
              dueDate,
              companyId: company.id,
              projectId: project.id,
              clientId,
              createdById: session.user.id,
            },
          });

          await prisma.projectMilestone.create({
            data: {
              projectId: project.id,
              title: inst.title,
              type: "PAYMENT",
              status: ci === 0 ? "UNLOCKED" : "LOCKED",
              order: ci,
              invoiceId: invoice.id,
            },
          });
        } else {
          await prisma.projectMilestone.create({
            data: {
              projectId: project.id,
              title: inst.title,
              type: "PAYMENT",
              status: ci === 0 ? "UNLOCKED" : "LOCKED",
              order: ci,
            },
          });
        }
      }
    } else if (template.milestones && template.milestones.length > 0) {
      for (const tm of template.milestones) {
        await prisma.projectMilestone.create({
          data: {
            projectId: project.id,
            title: tm.title,
            type: "PAYMENT",
            status: "LOCKED",
            order: tm.order,
          },
        });
      }
    }

    // جلب المشروع الكامل مع الخدمات والمهام
    const fullProject = await prisma.project.findUnique({
      where: { id: project.id },
      include: {
        client: { select: { id: true, name: true, email: true } },
        manager: { select: { id: true, name: true, email: true } },
        template: { select: { id: true, name: true } },
        services: {
          include: {
            tasks: {
              orderBy: { order: "asc" },
              include: {
                assignee: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });

    return NextResponse.json(fullProject, { status: 201 });
  } catch (error) {
    console.error("Error generating project from template:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء إنشاء المشروع من القالب" },
      { status: 500 }
    );
  }
}

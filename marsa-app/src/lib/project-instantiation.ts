import { prisma } from "@/lib/prisma";

interface InstantiateOptions {
  templateId: string;
  clientId: string;
  managerId: string;
  contractId?: string;
  name?: string;
}

/**
 * Instantiate a project from a template, optionally linked to a contract.
 * Returns the created project ID or null if template not found.
 */
export async function instantiateProjectFromTemplate(opts: InstantiateOptions): Promise<string | null> {
  const { templateId, clientId, managerId, contractId, name } = opts;

  // Extract contract data if linked
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
        const keys = ["totalAmount", "المبلغ_الإجمالي", "amount", "قيمة_العقد"];
        for (const k of keys) {
          const val = parseFloat(vars[k] || "0");
          if (val > 0) { contractTotalPrice = val; break; }
        }
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

  const template = await prisma.projectTemplate.findUnique({
    where: { id: templateId },
    include: {
      services: {
        include: {
          serviceTemplate: {
            include: {
              category: true,
              taskTemplates: { orderBy: { sortOrder: "asc" } },
              qualifiedEmployees: { include: { user: true } },
            },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
      milestones: { orderBy: { order: "asc" } },
    },
  });

  if (!template || template.services.length === 0) return null;

  const now = new Date();
  let totalPrice = 0;
  const projectEndDate = new Date(now);

  if (template.workflowType === "SEQUENTIAL") {
    let cumulativeDays = 0;
    for (const pts of template.services) {
      const st = pts.serviceTemplate;
      const dur = st.defaultDuration ?? st.taskTemplates.reduce((s, t) => s + t.defaultDuration, 0);
      cumulativeDays += dur;
      totalPrice += st.defaultPrice ?? 0;
    }
    projectEndDate.setDate(projectEndDate.getDate() + cumulativeDays);
  } else {
    let maxDur = 0;
    for (const pts of template.services) {
      const st = pts.serviceTemplate;
      const dur = st.defaultDuration ?? st.taskTemplates.reduce((s, t) => s + t.defaultDuration, 0);
      if (dur > maxDur) maxDur = dur;
      totalPrice += st.defaultPrice ?? 0;
    }
    projectEndDate.setDate(projectEndDate.getDate() + maxDur);
  }

  const project = await prisma.project.create({
    data: {
      name: name || template.name,
      description: template.description,
      workflowType: template.workflowType,
      status: "ACTIVE",
      clientId,
      managerId,
      templateId: template.id,
      totalPrice: contractTotalPrice || totalPrice,
      startDate: now,
      endDate: projectEndDate,
      ...(contractId ? { contractId } : {}),
    },
  });

  let serviceStartDate = new Date(now);

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
        startDate = new Date(template.workflowType === "SEQUENTIAL" ? serviceStartDate : now);
      }

      const dueDate = new Date(startDate);
      dueDate.setDate(dueDate.getDate() + tt.defaultDuration);

      const assigneeId = employees.length > 0 ? employees[i % employees.length].userId : null;

      // Create task one-by-one to enable TaskAssignment creation
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
        },
      });

      // Create TaskAssignment records for ALL qualified employees
      if (employees.length > 0) {
        await prisma.taskAssignment.createMany({
          data: employees.map((e) => ({ taskId: createdTask.id, userId: e.userId })),
          skipDuplicates: true,
        });
      }

      if (st.workflowType === "SEQUENTIAL") {
        currentTaskStart = new Date(dueDate);
      }
    }

    if (template.workflowType === "SEQUENTIAL") {
      const dur = st.defaultDuration ?? taskTemplates.reduce((s, t) => s + t.defaultDuration, 0);
      serviceStartDate = new Date(serviceStartDate);
      serviceStartDate.setDate(serviceStartDate.getDate() + dur);
    }
  }

  // Create payment milestones
  if (contractInstallments.length > 0) {
    const company = await prisma.company.findFirst();
    for (let ci = 0; ci < contractInstallments.length; ci++) {
      const inst = contractInstallments[ci];
      const dueDate = inst.dueAfterDays
        ? new Date(now.getTime() + inst.dueAfterDays * 24 * 60 * 60 * 1000)
        : projectEndDate;

      let invoiceId: string | undefined;
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
            createdById: managerId,
          },
        });
        invoiceId = invoice.id;
      }

      await prisma.projectMilestone.create({
        data: {
          projectId: project.id,
          title: inst.title,
          type: "PAYMENT",
          status: ci === 0 ? "UNLOCKED" : "LOCKED",
          order: ci,
          ...(invoiceId ? { invoiceId } : {}),
        },
      });
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

  return project.id;
}

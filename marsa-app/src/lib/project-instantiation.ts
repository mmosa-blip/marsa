import { prisma } from "@/lib/prisma";
import { addWorkingDays } from "@/lib/working-days";
import { spawnRecordItemsForProject } from "@/lib/record-spawn";

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
  let projectEndDate = new Date(now);

  if (template.workflowType === "SEQUENTIAL") {
    let cumulativeDays = 0;
    for (const pts of template.services) {
      const st = pts.serviceTemplate;
      const dur = st.defaultDuration ?? st.taskTemplates.reduce((s, t) => s + t.defaultDuration, 0);
      cumulativeDays += dur;
      totalPrice += st.defaultPrice ?? 0;
    }
    projectEndDate = addWorkingDays(projectEndDate, cumulativeDays);
  } else {
    let maxDur = 0;
    for (const pts of template.services) {
      const st = pts.serviceTemplate;
      const dur = st.defaultDuration ?? st.taskTemplates.reduce((s, t) => s + t.defaultDuration, 0);
      if (dur > maxDur) maxDur = dur;
      totalPrice += st.defaultPrice ?? 0;
    }
    projectEndDate = addWorkingDays(projectEndDate, maxDur);
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
        executionMode: ((pts as unknown as { executionMode?: string }).executionMode || "SEQUENTIAL") as "SEQUENTIAL" | "PARALLEL" | "INDEPENDENT",
        isBackground: !!(pts as unknown as { isBackground?: boolean }).isBackground,
        serviceOrder: (pts as unknown as { sortOrder?: number }).sortOrder ?? 0,
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

      const dueDate = addWorkingDays(startDate, tt.defaultDuration);

      const assigneeId = employees.length > 0 ? employees[i % employees.length].userId : null;

      // Auto-assigned tasks start immediately (acceptedAt set, status IN_PROGRESS)
      const createdTask = await prisma.task.create({
        data: {
          title: tt.name,
          status: assigneeId ? ("IN_PROGRESS" as const) : ("TODO" as const),
          priority: "MEDIUM" as const,
          order: tt.sortOrder,
          dueDate,
          serviceId: service.id,
          projectId: project.id,
          taskTemplateId: tt.id,
          assigneeId,
          assignedAt: assigneeId ? new Date() : null,
          acceptedAt: assigneeId ? new Date() : null,
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

      if (st.workflowType === "SEQUENTIAL") {
        currentTaskStart = new Date(dueDate);
      }
    }

    if (template.workflowType === "SEQUENTIAL") {
      const dur = st.defaultDuration ?? taskTemplates.reduce((s, t) => s + t.defaultDuration, 0);
      serviceStartDate = addWorkingDays(serviceStartDate, dur);
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

  // Tier 4 — spawn MISSING record items for every service-template
  // requirement so the team has a punch list. Best-effort: never block
  // project creation if this fails.
  try {
    await spawnRecordItemsForProject(project.id);
  } catch (err) {
    console.error("spawnRecordItemsForProject failed", err);
  }

  return project.id;
}

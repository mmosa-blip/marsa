import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pickInvestmentAssignee, isInvestmentDepartment } from "@/lib/investment-assign";
import { addWorkingDays } from "@/lib/working-days";
import { computeProjectDuration } from "@/lib/service-duration";
import { notifyProjectAssignment } from "@/lib/notifications";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    // Template-based project creation is open to executors (who now
    // have projects.create permission) alongside admin/manager.
    if (!session || !["ADMIN", "MANAGER", "EXECUTOR", "BRANCH_MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const body = await request.json();
    const { templateId, clientId, name, contractId, departmentId, managerId, executorId } = body;

    // ── Auto-distribution from DepartmentAssignmentPool ──
    let resolvedManagerId: string = managerId || session.user.id;
    let poolMode: "ROUND_ROBIN" | "ALL" | null = null;

    if (!managerId && departmentId) {
      const pool = await prisma.departmentAssignmentPool.findMany({
        where: { departmentId },
        orderBy: { order: "asc" },
      });
      if (pool.length > 0) {
        const mode = pool[0].mode === "ALL" ? "ALL" : "ROUND_ROBIN";
        poolMode = mode;
        if (mode === "ALL") {
          resolvedManagerId = pool[0].userId;
        } else {
          const sorted = [...pool].sort((a, b) => {
            const at = a.lastAssigned?.getTime() ?? 0;
            const bt = b.lastAssigned?.getTime() ?? 0;
            return at - bt;
          });
          resolvedManagerId = sorted[0].userId;
          await prisma.departmentAssignmentPool.update({
            where: { departmentId_userId: { departmentId, userId: sorted[0].userId } },
            data: { lastAssigned: new Date() },
          });
        }
      }
    }

    if (!templateId || !clientId) {
      return NextResponse.json(
        { error: "معرّف القالب ومعرّف العميل مطلوبان" },
        { status: 400 }
      );
    }

    // If contractId provided, extract totalAmount and installments from contract
    let contractTotalPrice: number | null = null;
    let contractInstallments: { title: string; amount: number; dueAfterDays: number | null; order: number }[] = [];
    let contractStartDate: Date | null = null;
    let contractEndDate: Date | null = null;
    if (contractId) {
      const contract = await prisma.contract.findUnique({
        where: { id: contractId },
        select: { variables: true, startDate: true, endDate: true, installments: { orderBy: { order: "asc" } } },
      });
      if (contract?.variables) {
        try {
          const vars = JSON.parse(contract.variables);
          const amount = parseFloat(vars.totalAmount || vars.المبلغ_الإجمالي || vars.amount || vars.قيمة_العقد || "0");
          if (amount > 0) contractTotalPrice = amount;
        } catch {}
      }
      contractStartDate = contract?.startDate ?? null;
      contractEndDate = contract?.endDate ?? null;
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

    // Per-service metadata for both the price sum and the critical-path
    // duration calculation. Services keep their template-level
    // executionMode and isBackground so computeProjectDuration can
    // respect parallel branches and skip background work. This replaces
    // the old SUM-everything-when-SEQUENTIAL / MAX-everything-when-
    // PARALLEL branching that ignored per-service modes entirely.
    const serviceDurations = template.services.map((pts) => {
      const st = pts.serviceTemplate;
      const duration =
        st.defaultDuration ??
        st.taskTemplates.reduce((sum, t) => sum + t.defaultDuration, 0);
      totalPrice += st.defaultPrice ?? 0;
      return {
        duration,
        executionMode: pts.executionMode as string,
        isBackground: pts.isBackground,
      };
    });

    const totalDuration = computeProjectDuration(serviceDurations);
    const projectEndDate = addWorkingDays(new Date(now), totalDuration);

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
        ...(contractStartDate ? { contractStartDate } : {}),
        ...(contractEndDate ? { contractEndDate } : {}),
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

      const svcDurationFallback =
        st.defaultDuration ??
        st.taskTemplates.reduce((sum, t) => sum + t.defaultDuration, 0);

      const service = await prisma.service.create({
        data: {
          name: st.name,
          description: st.description,
          price: st.defaultPrice,
          duration: svcDurationFallback,
          category: st.category?.name ?? null,
          clientId,
          projectId: project.id,
          serviceTemplateId: st.id,
          status: "IN_PROGRESS",
          executionMode: pts.executionMode,
          isBackground: pts.isBackground,
          serviceOrder: pts.sortOrder,
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

        const dueDate = addWorkingDays(startDate, tt.defaultDuration);

        // Assignee selection — same priority as POST /api/projects:
        //   1. executorId (explicit pick from wizard)
        //   2. poolMode ROUND_ROBIN → resolvedManagerId
        //   3. Investment → pickInvestmentAssignee
        //   4. qualifiedEmployees round-robin
        let assigneeId: string | null = null;
        if (executorId) {
          assigneeId = executorId;
        } else if (poolMode === "ROUND_ROBIN") {
          assigneeId = resolvedManagerId;
        } else if (isInvestment && employees.length > 0) {
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

        // Auto-assigned tasks start immediately (no acceptance step)
        const createdTask = await prisma.task.create({
          data: {
            title: tt.name,
            status: assigneeId ? ("IN_PROGRESS" as const) : ("TODO" as const),
            priority: "MEDIUM" as const,
            order: tt.sortOrder,
            dueDate,
            serviceId: service.id,
            projectId: project.id,
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
        serviceStartDate = addWorkingDays(serviceStartDate, serviceDuration);
      }
    }

    // Create payment milestones - contract installments take priority over template milestones.
    // Invoice creation removed: billing now flows through
    // ContractPaymentInstallment (set up by the contract flow) and the
    // /dashboard/payments page. Milestones remain so the project view
    // still renders the per-installment cards.
    if (contractInstallments.length > 0) {
      for (let ci = 0; ci < contractInstallments.length; ci++) {
        const inst = contractInstallments[ci];
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

      // ─── Materialize template milestones as ContractPaymentInstallment rows ───
      // The payments page reads from ContractPaymentInstallment, not
      // ProjectMilestone. Without this block, every Investment-template
      // project ended up invisible to /dashboard/payments because its
      // amounts never crossed over.
      //
      // For each template milestone:
      //   - afterServiceIndex = -1 → upfront payment, no task link, unlocked
      //   - afterServiceIndex = N  → links to the FIRST task of service[N+1]
      //                              (i.e. the service that follows the one
      //                              the milestone is paid "after")
      //
      // Skip rows with amount <= 0 to avoid noise.
      const billable = template.milestones.filter((m) => m.amount > 0);
      if (project.contractId && billable.length > 0) {
        const projectServicesOrdered = await prisma.service.findMany({
          where: { projectId: project.id, deletedAt: null },
          select: {
            id: true,
            name: true,
            serviceOrder: true,
            tasks: {
              select: { id: true },
              orderBy: { order: "asc" },
              take: 1,
            },
          },
          orderBy: { serviceOrder: "asc" },
        });

        const totalMilestoneSum = billable.reduce((s, m) => s + m.amount, 0);

        for (let mi = 0; mi < billable.length; mi++) {
          const tm = billable[mi];
          const isUpfront = tm.afterServiceIndex === -1;
          let linkedTaskId: string | null = null;

          if (!isUpfront) {
            const nextService = projectServicesOrdered[tm.afterServiceIndex + 1];
            const firstTaskOfNext = nextService?.tasks[0];
            if (firstTaskOfNext) {
              linkedTaskId = firstTaskOfNext.id;
            } else {
              console.warn(
                `[generate] template milestone "${tm.title}" afterServiceIndex=${tm.afterServiceIndex} has no resolvable next service/task — leaving linkedTaskId null`
              );
            }
          }

          await prisma.contractPaymentInstallment.create({
            data: {
              contractId: project.contractId,
              title: tm.title,
              amount: tm.amount,
              order: mi,
              percentage:
                totalMilestoneSum > 0
                  ? (tm.amount / totalMilestoneSum) * 100
                  : null,
              dueAfterDays: null, // milestone-based, not time-based
              isLocked: isUpfront ? false : mi > 0,
              ...(linkedTaskId ? { linkedTaskId } : {}),
            },
          });
        }

        // Backfill contractValue if the contract row never got priced.
        // The sum of milestones is the most accurate figure available
        // here (it is what the user actually committed to).
        await prisma.contract.updateMany({
          where: {
            id: project.contractId,
            OR: [{ contractValue: null }, { contractValue: 0 }],
          },
          data: { contractValue: totalMilestoneSum },
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

    // PROJECT_ASSIGNED notification — manager + every distinct task assignee.
    // The session creator is excluded so they don't get pinged about their
    // own action.
    const taskAssignees = await prisma.task.findMany({
      where: { projectId: project.id, assigneeId: { not: null }, deletedAt: null },
      select: { assigneeId: true },
      distinct: ["assigneeId"],
    });
    const recipients = Array.from(
      new Set([
        resolvedManagerId,
        ...taskAssignees.map((t) => t.assigneeId).filter((x): x is string => !!x),
      ])
    );
    await notifyProjectAssignment({
      projectId: project.id,
      userIds: recipients,
      excludeUserId: session.user.id,
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

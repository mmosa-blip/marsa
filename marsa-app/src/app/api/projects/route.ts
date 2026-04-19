import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { prismaDirect } from "@/lib/prisma-direct";
import { can, PERMISSIONS, hasPermission } from "@/lib/permissions";
import { createAuditLog, AuditModule } from "@/lib/audit";
import type { WorkflowType, ProjectPriority, MilestoneStatus } from "@/generated/prisma/client";
import { pickInvestmentAssignee, isInvestmentDepartment } from "@/lib/investment-assign";
import { generateProjectCode } from "@/lib/project-code";
import { addWorkingDays } from "@/lib/working-days";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get("departmentId");
    const withServices = searchParams.get("withServices") === "true";

    const where: Record<string, unknown> = { deletedAt: null };
    if (departmentId) where.departmentId = departmentId;

    if (session.user.role === "CLIENT") {
      where.clientId = session.user.id;
    } else if (session.user.role === "EXECUTOR") {
      // EXECUTOR sees projects they manage OR have assigned tasks in
      const assignedProjects = await prisma.task.findMany({
        where: { assigneeId: session.user.id, projectId: { not: undefined } } as Record<string, unknown>,
        select: { projectId: true },
        distinct: ["projectId"],
      });
      const assignedProjectIds = assignedProjects.map((t) => t.projectId).filter(Boolean) as string[];
      where.OR = [
        { managerId: session.user.id },
        { id: { in: assignedProjectIds } },
      ];
    }

    const projects = await prisma.project.findMany({
      where,
      include: {
        client: { select: { id: true, name: true, email: true } },
        manager: { select: { id: true, name: true, email: true } },
        department: { select: { id: true, name: true, nameEn: true, color: true } },
        tasks: { select: { id: true, status: true, dueDate: true } },
        _count: { select: { services: true } },
        ...(withServices
          ? {
              services: {
                select: {
                  id: true,
                  name: true,
                  status: true,
                  tasks: { select: { id: true, status: true, dueDate: true } },
                },
                orderBy: { serviceOrder: "asc" },
              },
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
    });

    const projectsWithProgress = projects.map((p) => {
      const total = p.tasks.length;
      const done = p.tasks.filter((t) => t.status === "DONE").length;
      return {
        ...p,
        progress: total > 0 ? Math.round((done / total) * 100) : 0,
        totalTasks: total,
        completedTasks: done,
      };
    });

    return NextResponse.json(projectsWithProgress);
  } catch (error) {
    console.error("Error fetching projects:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

interface PaymentMilestoneInput {
  title: string;
  amount: number;
  afterServiceIndex: number;
}

interface ServiceInput {
  serviceTemplateId: string;
  price: number;
  sortOrder: number;
  executionMode?: "SEQUENTIAL" | "PARALLEL" | "INDEPENDENT";
  isBackground?: boolean;
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    if (!(await can(session.user.id, session.user.role, PERMISSIONS.PROJECTS_CREATE))) {
      return NextResponse.json({ error: "ليس لديك صلاحية للقيام بهذا الإجراء" }, { status: 403 });
    }

    const body = await request.json();
    const {
      clientId,
      name,
      description,
      workflowType,
      totalPrice,
      services,
      priority,
      paymentMilestones,
      departmentId,
      contractId,
      contractStartDate,
      contractDurationDays,
      contractEndDate,
      managerId,
      executorId,
      partners,
    } = body as {
      clientId: string;
      name: string;
      description?: string;
      workflowType?: string;
      totalPrice?: number;
      services?: ServiceInput[];
      priority?: string;
      paymentMilestones?: PaymentMilestoneInput[];
      departmentId?: string;
      contractId?: string;
      contractStartDate?: string;
      contractDurationDays?: number;
      contractEndDate?: string;
      managerId?: string;
      executorId?: string;
      partners?: { name: string; order?: number }[];
    };

    if (!name || !clientId) {
      return NextResponse.json({ error: "اسم المشروع والعميل مطلوبان" }, { status: 400 });
    }

    // If services provided, create full project with services, tasks, requirements, and milestones
    if (services && services.length > 0) {
      const result = await prismaDirect.$transaction(async (tx) => {
        // ── Auto-distribution from DepartmentAssignmentPool ─────────────────
        let resolvedManagerId: string = managerId || session.user.id;
        let poolMode: "ROUND_ROBIN" | "ALL" | null = null;
        let poolAllMemberIds: string[] = [];

        if (!managerId && departmentId) {
          const pool = await tx.departmentAssignmentPool.findMany({
            where: { departmentId },
            orderBy: { order: "asc" },
          });
          if (pool.length > 0) {
            const mode = pool[0].mode === "ALL" ? "ALL" : "ROUND_ROBIN";
            poolMode = mode;
            if (mode === "ALL") {
              resolvedManagerId = pool[0].userId;
              poolAllMemberIds = pool.map((p) => p.userId);
            } else {
              const sorted = [...pool].sort((a, b) => {
                const at = a.lastAssigned?.getTime() ?? 0;
                const bt = b.lastAssigned?.getTime() ?? 0;
                return at - bt;
              });
              const next = sorted[0];
              resolvedManagerId = next.userId;
              await tx.departmentAssignmentPool.update({
                where: {
                  departmentId_userId: { departmentId, userId: next.userId },
                },
                data: { lastAssigned: new Date() },
              });
            }
          }
        }

        // If contractId provided, extract totalAmount and installments from contract
        let contractTotalPrice: number | null = null;
        let contractInstallments: { title: string; amount: number; dueAfterDays: number | null; order: number }[] = [];
        if (contractId) {
          const contract = await tx.contract.findUnique({
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

        // Generate the human-readable project code
        const { code: projectCode, seq: projectSeq } = await generateProjectCode(tx, {
          clientId,
          departmentId,
          contractId,
        });

        const now = new Date();

        // Calculate total duration and price
        let calculatedPrice = 0;
        let totalDuration = 0;

        // Fetch all service templates
        const templateIds = services.map((s) => s.serviceTemplateId);
        const serviceTemplates = await tx.serviceTemplate.findMany({
          where: { id: { in: templateIds } },
          include: {
            category: true,
            taskTemplates: { orderBy: { sortOrder: "asc" } },
            qualifiedEmployees: true,
          },
        });

        const templateMap = new Map(serviceTemplates.map(t => [t.id, t]));

        // Get executors linked via UserService for each service
        const serviceExecutors = await tx.userService.findMany({
          where: { serviceId: { in: services.map(s => s.serviceTemplateId) } },
          select: { userId: true, serviceId: true },
        });
        const executorMap = new Map<string, string[]>();
        for (const se of serviceExecutors) {
          if (!executorMap.has(se.serviceId)) executorMap.set(se.serviceId, []);
          executorMap.get(se.serviceId)!.push(se.userId);
        }

        // Calculate durations
        for (const svc of services) {
          const tmpl = templateMap.get(svc.serviceTemplateId);
          if (!tmpl) continue;
          const svcDuration = tmpl.defaultDuration || tmpl.taskTemplates.reduce((s: number, t) => s + t.defaultDuration, 0);
          calculatedPrice += svc.price || tmpl.defaultPrice || 0;

          if (workflowType === "SEQUENTIAL") {
            totalDuration += svcDuration;
          } else {
            totalDuration = Math.max(totalDuration, svcDuration);
          }
        }

        const endDate = addWorkingDays(now, totalDuration);

        // Create project
        const project = await tx.project.create({
          data: {
            name,
            description: description || null,
            clientId,
            managerId: resolvedManagerId,
            workflowType: (workflowType || "SEQUENTIAL") as WorkflowType,
            totalPrice: contractTotalPrice || totalPrice || calculatedPrice,
            status: "ACTIVE",
            priority: (priority || "MEDIUM") as ProjectPriority,
            startDate: now,
            endDate,
            departmentId: departmentId || null,
            contractId: contractId || null,
            contractStartDate: contractStartDate ? new Date(contractStartDate) : null,
            contractDurationDays: contractDurationDays || null,
            contractEndDate: contractEndDate ? new Date(contractEndDate) : null,
            projectCode,
            projectSeq,
          },
        });

        // Persist project partners
        if (Array.isArray(partners) && partners.length > 0) {
          for (let pi = 0; pi < partners.length; pi++) {
            const p = partners[pi];
            const pname = (p?.name || "").trim();
            if (!pname) continue;
            await tx.projectPartner.create({
              data: {
                projectId: project.id,
                name: pname,
                order: typeof p.order === "number" ? p.order : pi,
              },
            });
          }
        }

        // ─── "Before project start" payment milestones ───
        if (contractInstallments.length === 0 && paymentMilestones && paymentMilestones.length > 0) {
          const beforeStartMilestones = paymentMilestones.filter((p) => p.afterServiceIndex === -1);
          for (const pm of beforeStartMilestones) {
            const company = await tx.company.findFirst();
            let invoiceId: string | undefined;
            if (company) {
              const invoiceNumber = `INV-${project.id.slice(-6).toUpperCase()}-PM-PRE`;
              const invoice = await tx.invoice.create({
                data: {
                  invoiceNumber,
                  title: pm.title,
                  subtotal: pm.amount,
                  taxRate: 15,
                  taxAmount: pm.amount * 0.15,
                  totalAmount: pm.amount * 1.15,
                  status: "DRAFT",
                  dueDate: now,
                  companyId: company.id,
                  projectId: project.id,
                  clientId,
                  createdById: session.user.id,
                },
              });
              invoiceId = invoice.id;
            }
            await tx.projectMilestone.create({
              data: {
                projectId: project.id,
                title: pm.title,
                type: "PAYMENT",
                status: "LOCKED",
                order: -1,
                ...(invoiceId ? { invoiceId } : {}),
              },
            });
          }
        }

        // ─── Create services, tasks, and milestones ───
        let serviceStartDate = new Date(now);
        let milestoneOrder = 0;
        const createdServiceIds: string[] = [];

        for (let si = 0; si < services.length; si++) {
          const svcInput = services[si];
          const tmpl = templateMap.get(svcInput.serviceTemplateId);
          if (!tmpl) continue;

          const svcDuration = tmpl.defaultDuration || tmpl.taskTemplates.reduce((s: number, t) => s + t.defaultDuration, 0);
          const svcPrice = svcInput.price || tmpl.defaultPrice;

          const serviceMode = svcInput.executionMode || "SEQUENTIAL";
          const serviceIsBackground = svcInput.isBackground || false;
          const service = await tx.service.create({
            data: {
              name: tmpl.name,
              description: tmpl.description,
              category: tmpl.category?.name || null,
              price: svcPrice,
              duration: svcDuration,
              clientId,
              projectId: project.id,
              serviceTemplateId: svcInput.serviceTemplateId,
              status: "IN_PROGRESS",
              serviceOrder: si,
              executionMode: serviceMode,
              isBackground: serviceIsBackground,
            },
          });

          createdServiceIds.push(service.id);

          // Create SERVICE type milestone
          await tx.projectMilestone.create({
            data: {
              projectId: project.id,
              title: tmpl.name,
              type: "SERVICE",
              status: (si === 0 ? "IN_PROGRESS" : "LOCKED") as MilestoneStatus,
              order: milestoneOrder++,
              serviceId: service.id,
            },
          });

          // Generate tasks from task templates
          const taskTemplates = tmpl.taskTemplates;
          const employees = tmpl.qualifiedEmployees;
          let taskStartDate = new Date(serviceStartDate);

          // Check if this is an Investment department project
          const isInvestment = await isInvestmentDepartment(departmentId, tx);

          // Map from TaskTemplate ID to created Task ID
          const templateToTaskId = new Map<string, string>();

          for (let idx = 0; idx < taskTemplates.length; idx++) {
            const tt = taskTemplates[idx];

            let startDate: Date;
            if (tmpl.workflowType === "SEQUENTIAL") {
              startDate = new Date(taskStartDate);
            } else {
              startDate = new Date(serviceStartDate);
            }

            const dueDate = addWorkingDays(startDate, tt.defaultDuration);

            if (tmpl.workflowType === "SEQUENTIAL") {
              taskStartDate = new Date(dueDate);
            }

            // Resolve dependency
            const taskDependsOnId = tt.dependsOnId ? templateToTaskId.get(tt.dependsOnId) || null : null;

            // Assignee selection
            let assigneeId: string | null = null;
            if (executorId) {
              assigneeId = executorId;
            } else if (poolMode === "ROUND_ROBIN") {
              assigneeId = resolvedManagerId;
            } else if (poolMode === "ALL") {
              assigneeId = poolAllMemberIds[0] || resolvedManagerId;
            } else if (isInvestment && employees.length > 0) {
              assigneeId = await pickInvestmentAssignee({
                projectId: project.id,
                serviceId: service.id,
                qualifiedEmployeeIds: employees.map((e) => e.userId),
                fallbackIndex: idx,
                db: tx,
              });
            } else {
              assigneeId = employees.length > 0
                ? employees[idx % employees.length].userId
                : (executorMap.get(svcInput.serviceTemplateId)?.[0] || null);
            }

            const createdTask = await tx.task.create({
              data: {
                title: tt.name,
                status: "TODO",
                priority: "MEDIUM",
                order: tt.sortOrder,
                dueDate,
                serviceId: service.id,
                projectId: project.id,
                taskTemplateId: tt.id,
                assigneeId,
                dependsOnId: taskDependsOnId,
                executionMode: serviceMode,
              },
            });

            templateToTaskId.set(tt.id, createdTask.id);

            // Auto-assigned by the system → start immediately
            if (createdTask.assigneeId) {
              await tx.taskAssignment.upsert({
                where: { taskId_userId: { taskId: createdTask.id, userId: createdTask.assigneeId } },
                create: { taskId: createdTask.id, userId: createdTask.assigneeId },
                update: {},
              });
              const now = new Date();
              await tx.task.update({
                where: { id: createdTask.id },
                data: { assignedAt: now, acceptedAt: now, status: "IN_PROGRESS" },
              });
            }

            // Pool ALL-mode co-assignments
            if (poolMode === "ALL" && poolAllMemberIds.length > 0) {
              for (const uid of poolAllMemberIds) {
                if (uid === createdTask.assigneeId) continue;
                await tx.taskAssignment.upsert({
                  where: { taskId_userId: { taskId: createdTask.id, userId: uid } },
                  create: { taskId: createdTask.id, userId: uid },
                  update: {},
                });
              }
            }
          }

          // ─── Create PAYMENT milestones after this service ───
          if (contractInstallments.length === 0 && paymentMilestones && paymentMilestones.length > 0) {
            const milestonesAfter = paymentMilestones.filter((p) => p.afterServiceIndex === si);
            for (const pm of milestonesAfter) {
              const company = await tx.company.findFirst();

              if (company) {
                const invoiceNumber = `INV-${project.id.slice(-6).toUpperCase()}-PM${milestoneOrder}`;
                const invoice = await tx.invoice.create({
                  data: {
                    invoiceNumber,
                    title: pm.title,
                    subtotal: pm.amount,
                    taxRate: 15,
                    taxAmount: pm.amount * 0.15,
                    totalAmount: pm.amount * 1.15,
                    status: "DRAFT",
                    dueDate: endDate,
                    companyId: company.id,
                    projectId: project.id,
                    clientId,
                    createdById: session.user.id,
                  },
                });

                await tx.projectMilestone.create({
                  data: {
                    projectId: project.id,
                    title: pm.title,
                    type: "PAYMENT",
                    status: "LOCKED",
                    order: milestoneOrder++,
                    invoiceId: invoice.id,
                  },
                });
              } else {
                await tx.projectMilestone.create({
                  data: {
                    projectId: project.id,
                    title: pm.title,
                    type: "PAYMENT",
                    status: "LOCKED",
                    order: milestoneOrder++,
                  },
                });
              }
            }
          }

          // Update service start for next service (SEQUENTIAL project workflow)
          if (workflowType === "SEQUENTIAL") {
            serviceStartDate = addWorkingDays(serviceStartDate, svcDuration);
          }
        }

        // ─── Materialize paymentMilestones as ContractPaymentInstallment rows ───
        if (
          project.contractId &&
          contractInstallments.length === 0 &&
          paymentMilestones &&
          paymentMilestones.length > 0
        ) {
          const projectServicesOrdered = await tx.service.findMany({
            where: { projectId: project.id, deletedAt: null },
            select: {
              id: true,
              tasks: {
                select: { id: true },
                orderBy: { order: "asc" },
                take: 1,
              },
            },
            orderBy: { serviceOrder: "asc" },
          });

          for (let pmi = 0; pmi < paymentMilestones.length; pmi++) {
            const pm = paymentMilestones[pmi];
            const nextService = projectServicesOrdered[pm.afterServiceIndex + 1];
            const firstTaskOfNext = nextService?.tasks[0];

            await tx.contractPaymentInstallment.create({
              data: {
                contractId: project.contractId,
                title: pm.title,
                amount: pm.amount,
                order: pmi,
                isLocked: true,
                ...(firstTaskOfNext ? { linkedTaskId: firstTaskOfNext.id } : {}),
              },
            });
          }
        }

        // ─── Create payment milestones from contract installments ───
        if (contractInstallments.length > 0) {
          for (let ci = 0; ci < contractInstallments.length; ci++) {
            const inst = contractInstallments[ci];
            const dueDate = inst.dueAfterDays
              ? new Date(now.getTime() + inst.dueAfterDays * 24 * 60 * 60 * 1000)
              : endDate;

            const company = await tx.company.findFirst();
            if (company) {
              const invoiceNumber = `INV-${project.id.slice(-6).toUpperCase()}-CI${ci}`;
              const invoice = await tx.invoice.create({
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

              await tx.projectMilestone.create({
                data: {
                  projectId: project.id,
                  title: inst.title,
                  type: "PAYMENT",
                  status: ci === 0 ? "UNLOCKED" : "LOCKED",
                  order: milestoneOrder++,
                  invoiceId: invoice.id,
                },
              });
            } else {
              await tx.projectMilestone.create({
                data: {
                  projectId: project.id,
                  title: inst.title,
                  type: "PAYMENT",
                  status: ci === 0 ? "UNLOCKED" : "LOCKED",
                  order: milestoneOrder++,
                },
              });
            }
          }
        }

        // Auto-assign unassigned tasks by matching UserService name
        const allUserServices = await tx.userService.findMany({
          include: { service: { select: { name: true } } },
        });
        const projectServices = await tx.service.findMany({
          where: { projectId: project.id },
          select: { id: true, name: true },
        });
        for (const us of allUserServices) {
          const svcName = (us.service as { name: string } | null)?.name;
          if (!svcName) continue;
          const matchingIds = projectServices.filter((ps) => ps.name === svcName).map((ps) => ps.id);
          if (matchingIds.length === 0) continue;
          const unassignedTasks = await tx.task.findMany({
            where: { serviceId: { in: matchingIds }, assigneeId: null },
            select: { id: true },
          });
          if (unassignedTasks.length > 0) {
            await tx.task.updateMany({
              where: { id: { in: unassignedTasks.map((t) => t.id) } },
              data: { assigneeId: us.userId, assignedAt: new Date() },
            });
            for (const task of unassignedTasks) {
              await tx.taskAssignment.upsert({
                where: { taskId_userId: { taskId: task.id, userId: us.userId } },
                create: { taskId: task.id, userId: us.userId },
                update: {},
              });
            }
          }
        }

        return project;
      }, {
        timeout: 30000,
        maxWait: 10000,
      });

      // Outside transaction: audit log (fire-and-forget)
      createAuditLog({
        userId: session.user.id, userName: session.user.name || undefined, userRole: session.user.role,
        action: "PROJECT_CREATED", module: AuditModule.PROJECTS,
        entityType: "Project", entityId: result.id, entityName: name,
        after: { clientId, services: services?.length || 0, contractId: contractId || null },
      });

      // Outside transaction: final read (pooled client is fine for reads)
      const fullProject = await prisma.project.findUnique({
        where: { id: result.id },
        include: {
          client: { select: { id: true, name: true } },
          services: { include: { tasks: { orderBy: { order: "asc" } } } },
          milestones: { orderBy: { order: "asc" } },
          _count: { select: { tasks: true, services: true } },
        },
      });

      return NextResponse.json(fullProject, { status: 201 });
    }

    // ── Simple project creation (legacy) — wrapped in its own transaction ──
    const legacyResult = await prismaDirect.$transaction(async (tx) => {
      // Pool resolution for legacy path
      let resolvedManagerId: string = managerId || session.user.id;

      if (!managerId && departmentId) {
        const pool = await tx.departmentAssignmentPool.findMany({
          where: { departmentId },
          orderBy: { order: "asc" },
        });
        if (pool.length > 0) {
          const mode = pool[0].mode === "ALL" ? "ALL" : "ROUND_ROBIN";
          if (mode === "ALL") {
            resolvedManagerId = pool[0].userId;
          } else {
            const sorted = [...pool].sort((a, b) => {
              const at = a.lastAssigned?.getTime() ?? 0;
              const bt = b.lastAssigned?.getTime() ?? 0;
              return at - bt;
            });
            const next = sorted[0];
            resolvedManagerId = next.userId;
            await tx.departmentAssignmentPool.update({
              where: {
                departmentId_userId: { departmentId, userId: next.userId },
              },
              data: { lastAssigned: new Date() },
            });
          }
        }
      }

      // Contract total price for legacy path
      let contractTotalPrice: number | null = null;
      if (contractId) {
        const contract = await tx.contract.findUnique({
          where: { id: contractId },
          select: { variables: true },
        });
        if (contract?.variables) {
          try {
            const vars = JSON.parse(contract.variables);
            const amount = parseFloat(vars.totalAmount || vars.المبلغ_الإجمالي || vars.amount || vars.قيمة_العقد || "0");
            if (amount > 0) contractTotalPrice = amount;
          } catch {}
        }
      }

      const { code: projectCode, seq: projectSeq } = await generateProjectCode(tx, {
        clientId,
        departmentId,
        contractId,
      });

      const project = await tx.project.create({
        data: {
          name,
          description: description || null,
          clientId,
          managerId: resolvedManagerId,
          priority: (priority || "MEDIUM") as ProjectPriority,
          workflowType: (workflowType || "SEQUENTIAL") as WorkflowType,
          totalPrice: contractTotalPrice || totalPrice || null,
          departmentId: departmentId || null,
          contractId: contractId || null,
          contractStartDate: contractStartDate ? new Date(contractStartDate) : null,
          contractDurationDays: contractDurationDays || null,
          contractEndDate: contractEndDate ? new Date(contractEndDate) : null,
          projectCode,
          projectSeq,
        },
      });

      return project;
    }, {
      timeout: 10000,
    });

    // Outside transaction: audit log
    createAuditLog({
      userId: session.user.id, userName: session.user.name || undefined, userRole: session.user.role,
      action: "PROJECT_CREATED", module: AuditModule.PROJECTS,
      entityType: "Project", entityId: legacyResult.id, entityName: name,
      after: { clientId, contractId: contractId || null },
    });

    // Re-fetch with relations for the response
    const legacyProject = await prisma.project.findUnique({
      where: { id: legacyResult.id },
      include: {
        client: { select: { id: true, name: true } },
        manager: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(legacyProject, { status: 201 });
  } catch (error) {
    console.error("Error creating project:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

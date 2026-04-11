import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { reassignStaleTasks } from "@/lib/task-assignment";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    // Fire-and-forget stale task reassignment
    reassignStaleTasks().catch(() => {});

    const { searchParams } = request.nextUrl;
    const status = searchParams.get("status") || "";
    const priority = searchParams.get("priority") || "";
    const project = searchParams.get("project") || "";
    const service = searchParams.get("service") || "";
    const time = searchParams.get("time") || "";
    const search = searchParams.get("search") || "";
    const dateFrom = searchParams.get("dateFrom") || "";
    const dateTo = searchParams.get("dateTo") || "";
    // When set, the response switches from "my tasks" to "all tasks of this
    // project" — the executor city's project picker uses this so an employee
    // can see the full board for a project they're working on.
    const projectId = searchParams.get("projectId") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") || "15", 10)));

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    // Project-mode permission gate: a non-admin/manager must have at least
    // one task in the project (as primary assignee or as a TaskAssignment
    // collaborator). Otherwise we'd be leaking project tasks to anyone who
    // can guess a project id.
    //
    // On gate failure we return an empty list (200) instead of 403 so the
    // client UI degrades to "no tasks" rather than an error toast or stuck
    // loading state. The picker chips in the executor city can show
    // projects the user only has TaskAssignment access to, so a 403 here
    // would surface as a confusing error in those cases.
    if (projectId && !["ADMIN", "MANAGER"].includes(session.user.role)) {
      const hasAccess = await prisma.task.findFirst({
        where: {
          projectId,
          OR: [
            { assigneeId: session.user.id },
            { assignments: { some: { userId: session.user.id } } },
          ],
        },
        select: { id: true },
      });
      if (!hasAccess) {
        return NextResponse.json({ tasks: [], total: 0, page: 1, totalPages: 0 });
      }
    }

    // Default mode: only the user's own tasks. Project mode: every task in
    // the project regardless of assignee.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      ...(projectId ? { projectId } : { assigneeId: session.user.id }),
      // Hide soft-deleted tasks (set when their parent service is deleted)
      deletedAt: null,
      project: {
        deletedAt: null,
        ...(project && { name: { contains: project } }),
      },
      ...(time === "today" && { dueDate: { gte: todayStart, lt: todayEnd } }),
      ...(time === "overdue" && { dueDate: { lt: todayStart } }),
      ...(time === "future" && { dueDate: { gte: todayEnd } }),
    };

    if (service) {
      where.service = { name: { contains: service } };
    }

    if (status) {
      const statuses = status.split(",");
      where.status = statuses.length > 1 ? { in: statuses } : status;
    }

    if (priority) {
      where.priority = priority;
    }

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { project: { name: { contains: search } } },
      ];
    }

    if (dateFrom || dateTo) {
      where.dueDate = {};
      if (dateFrom) where.dueDate.gte = new Date(dateFrom);
      if (dateTo) where.dueDate.lte = new Date(dateTo + "T23:59:59.999Z");
    }

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        include: {
          project: {
            select: {
              id: true,
              name: true,
              projectCode: true,
              isQuickService: true,
              client: { select: { id: true, name: true } },
              services: {
                select: {
                  id: true,
                  isBackground: true,
                  tasks: {
                    // executionMode is needed by computeCanStart to skip
                    // INDEPENDENT/PARALLEL siblings when looking for the
                    // immediate previous SEQUENTIAL task in the same service.
                    select: {
                      id: true,
                      status: true,
                      order: true,
                      assigneeId: true,
                      executionMode: true,
                    },
                  },
                },
                // CRITICAL: order by `serviceOrder`, not `createdAt`. The
                // services list is what computeCanStart uses to figure out
                // which service comes "before" the current one when checking
                // sequential dependencies. createdAt drifts as soon as the
                // user reorders services in the project, leaving the chain
                // out of sync with the visible order.
                //
                // Tie-breaker: when serviceOrder values collide (legacy data
                // where every row had the schema default of 0), fall back
                // to createdAt so the ordering stays deterministic across
                // queries instead of becoming row-id roulette.
                orderBy: [{ serviceOrder: "asc" }, { createdAt: "asc" }]
              }
            },
          },
          service: { select: { id: true, name: true } },
          assignee: { select: { id: true, name: true } },
          linkedInstallment: {
            select: {
              id: true,
              isLocked: true,
              title: true,
              amount: true,
              paidAmount: true,
              paymentStatus: true,
              partialPaymentRequest: true,
              partialPaymentType: true,
              gracePeriodDays: true,
              gracePeriodEnd: true,
              gracePeriodApproved: true,
            },
          },
          timeSummary: true,
          assignments: { include: { user: { select: { id: true, name: true } } } },
          startedBy: { select: { id: true, name: true } },
          externalProviders: {
            where: { providerStatus: { not: "CANCELLED" } },
            include: {
              provider: { select: { id: true, name: true, phone: true } },
              reminders: {
                orderBy: { remindedAt: "desc" },
                take: 1,
              },
              _count: { select: { reminders: true } },
            },
            orderBy: { linkedAt: "desc" },
            take: 1,
          },
          governmentHolds: {
            where: { isActive: true },
            include: {
              updates: {
                orderBy: { addedAt: "desc" },
                include: { addedBy: { select: { name: true } } },
              },
            },
            take: 1,
          },
          transferRequests: {
            where: { status: { in: ["PENDING_ADMIN", "PENDING_TARGET", "APPROVED"] } },
            select: {
              id: true,
              status: true,
              reason: true,
              targetUserId: true,
              requesterId: true,
              requester: { select: { id: true, name: true } },
              targetUser: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
        orderBy: [{ serviceId: "asc" }, { order: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.task.count({ where }),
    ]);

    // canStart rules:
    //
    //   1. Payment lock always wins — a task linked to a locked installment
    //      is blocked regardless of its mode or position in the chain.
    //   2. INDEPENDENT tasks bypass EVERY check — runnable any time once
    //      the payment lock (if any) clears.
    //   3. PARALLEL tasks skip the per-task order check inside their
    //      service (sibling tasks may run simultaneously) but still wait
    //      for the previous service to be terminally finished.
    //   4. SEQUENTIAL tasks (the default) wait for both:
    //        a. The immediate previous non-INDEPENDENT task in the same
    //           service must be in a terminal state (DONE or CANCELLED).
    //        b. Every non-INDEPENDENT task in the previous service must
    //           also be in a terminal state.
    //
    // CANCELLED is treated like DONE — a cancelled predecessor doesn't
    // block downstream work. INDEPENDENT siblings are skipped on the way
    // back through the chain because they were never part of the linear
    // flow to begin with.
    const TERMINAL = new Set(["DONE", "CANCELLED"]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const computeCanStart = (task: any): { canStart: boolean; blockReason: string | null } => {
      if (task.linkedInstallment?.isLocked) {
        // Grace-period bypass: if the admin approved a temporary
        // unlock (gracePeriodApproved) and the end date hasn't passed
        // yet, the task is temporarily unlocked for the executor.
        const gi = task.linkedInstallment;
        const graceActive =
          gi.gracePeriodApproved &&
          gi.gracePeriodEnd &&
          new Date(gi.gracePeriodEnd) > now;
        if (!graceActive) {
          return { canStart: false, blockReason: "payment" };
        }
        // else: grace period still running → fall through to normal checks
      }

      if (task.executionMode === "INDEPENDENT") {
        return { canStart: true, blockReason: null };
      }

      const project = task.project;
      const services = project?.services || [];
      if (!project || !task.serviceId) return { canStart: true, blockReason: null };

      // Background services start immediately with the project — their
      // tasks don't wait for any preceding service to finish. Internal
      // task ordering (SEQUENTIAL within the service) still applies via
      // the check at (a) below.
      const currentService = services.find((s: { id: string }) => s.id === task.serviceId);
      if ((currentService as { isBackground?: boolean })?.isBackground) {
        // Only check intra-service predecessor (below at (a)), skip
        // the inter-service gate at (b).
        if (task.executionMode !== "PARALLEL") {
          const prevTask = ((currentService as { tasks?: { id: string; status: string; order: number; executionMode: string }[] })?.tasks || [])
            .filter((t) => t.order < task.order && t.executionMode !== "INDEPENDENT")
            .sort((a, b) => b.order - a.order)[0];
          if (prevTask && !TERMINAL.has(prevTask.status)) {
            return { canStart: false, blockReason: "sequential" };
          }
        }
        return { canStart: true, blockReason: null };
      }

      // (a) Immediate previous non-INDEPENDENT task in the SAME service.
      //     PARALLEL tasks SKIP this check — siblings can run together.
      if (task.executionMode !== "PARALLEL") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const currentService = services.find((s: any) => s.id === task.serviceId);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const prevTask = (currentService?.tasks as any[] | undefined)
          ?.filter((t) => t.order < task.order && t.executionMode !== "INDEPENDENT")
          .sort((a, b) => b.order - a.order)[0];
        if (prevTask && !TERMINAL.has(prevTask.status)) {
          return { canStart: false, blockReason: "sequential" };
        }
      }

      // (b) Previous non-background service must be terminally finished
      //     (excluding INDEPENDENT). Background services run from the
      //     start and never block the services that follow them — walk
      //     backwards to find the first non-background predecessor.
      const currentServiceIdx = services.findIndex((s: { id: string }) => s.id === task.serviceId);
      if (currentServiceIdx > 0) {
        let prevIdx = currentServiceIdx - 1;
        while (prevIdx >= 0 && (services[prevIdx] as { isBackground?: boolean }).isBackground) {
          prevIdx--;
        }
        if (prevIdx >= 0) {
          const prevService = services[prevIdx];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const blocking = (prevService.tasks as any[]).filter(
            (t) => t.executionMode !== "INDEPENDENT" && !TERMINAL.has(t.status)
          );
          if (blocking.length > 0) {
            return { canStart: false, blockReason: "sequential" };
          }
        }
      }

      return { canStart: true, blockReason: null };
    };

    const tasksWithCanStart = tasks.map((t: any) => {
      const activeTransfer = t.transferRequests?.[0] || null;
      const startInfo = computeCanStart(t);
      return {
        ...t,
        canStart: startInfo.canStart,
        blockReason: startInfo.blockReason,
        isTransferred: !!activeTransfer,
        transferInfo: activeTransfer ? {
          id: activeTransfer.id,
          status: activeTransfer.status,
          reason: activeTransfer.reason,
          fromUser: activeTransfer.requester?.name || null,
          toUser: activeTransfer.targetUser?.name || null,
          targetUserId: activeTransfer.targetUserId,
          requesterId: activeTransfer.requesterId,
        } : null,
      };
    });

    return NextResponse.json({
      tasks: tasksWithCanStart,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching my tasks:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

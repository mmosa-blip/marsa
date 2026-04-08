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
        return NextResponse.json({ error: "ليس لديك صلاحية" }, { status: 403 });
      }
    }

    // Default mode: only the user's own tasks. Project mode: every task in
    // the project regardless of assignee.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      ...(projectId ? { projectId } : { assigneeId: session.user.id }),
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
              isQuickService: true,
              client: { select: { id: true, name: true } },
              services: {
                include: {
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
                orderBy: { createdAt: "asc" }
              }
            },
          },
          service: { select: { id: true, name: true } },
          assignee: { select: { id: true, name: true } },
          linkedInstallment: { select: { isLocked: true, title: true } },
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

    // canStart honors three signals (in order):
    //   1. payment lock — always wins
    //   2. task.executionMode (INDEPENDENT / PARALLEL / SEQUENTIAL — default)
    //   3. explicit task.dependsOnId
    //
    // Conceptually:
    //   - INDEPENDENT  → no dependency, runnable any time
    //   - dependsOnId  → only that specific parent must be DONE
    //   - PARALLEL     → no order chain, but the previous service must be done
    //   - SEQUENTIAL   → previous service must be done AND the immediate
    //                    previous SEQUENTIAL task in the same service must be
    //                    DONE (we skip over INDEPENDENT/PARALLEL siblings —
    //                    they aren't part of the linear chain)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const computeCanStart = (task: any): { canStart: boolean; blockReason: string | null } => {
      if (task.linkedInstallment?.isLocked) {
        return { canStart: false, blockReason: "payment" };
      }

      if (task.executionMode === "INDEPENDENT") {
        return { canStart: true, blockReason: null };
      }

      const project = task.project;
      const services = project?.services || [];

      // Explicit dependency wins over the order-based fallback.
      if (task.dependsOnId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let parent: any = null;
        for (const s of services) {
          const found = s.tasks.find((t: { id: string }) => t.id === task.dependsOnId);
          if (found) { parent = found; break; }
        }
        if (parent && parent.status !== "DONE") {
          return { canStart: false, blockReason: "sequential" };
        }
        return { canStart: true, blockReason: null };
      }

      if (!project || !task.serviceId) return { canStart: true, blockReason: null };

      const currentServiceIdx = services.findIndex((s: { id: string }) => s.id === task.serviceId);

      // Previous service must be fully DONE before any task in the next
      // service can run — applies to PARALLEL and SEQUENTIAL alike. INDEPENDENT
      // already returned above.
      if (currentServiceIdx > 0) {
        const prevService = services[currentServiceIdx - 1];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const allPrevDone = prevService.tasks.every((t: any) => t.status === "DONE");
        if (!allPrevDone) return { canStart: false, blockReason: "sequential" };
      }

      // PARALLEL skips the per-task order chain inside the service.
      if (task.executionMode === "PARALLEL") {
        return { canStart: true, blockReason: null };
      }

      // SEQUENTIAL (default): wait for the immediate previous SEQUENTIAL task
      // in the same service. INDEPENDENT/PARALLEL siblings are skipped — they
      // aren't part of the linear chain.
      const currentService = services[currentServiceIdx];
      if (currentService) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sequentialPrev = (currentService.tasks as any[])
          .filter((t) =>
            t.order < task.order &&
            t.executionMode !== "INDEPENDENT" &&
            t.executionMode !== "PARALLEL"
          )
          .sort((a, b) => b.order - a.order)[0];
        if (sequentialPrev && sequentialPrev.status !== "DONE") {
          return { canStart: false, blockReason: "sequential" };
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

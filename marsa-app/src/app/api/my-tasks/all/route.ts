import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const status = searchParams.get("status") || "";
    const priority = searchParams.get("priority") || "";
    const project = searchParams.get("project") || "";
    const service = searchParams.get("service") || "";
    const time = searchParams.get("time") || "";
    const search = searchParams.get("search") || "";
    const dateFrom = searchParams.get("dateFrom") || "";
    const dateTo = searchParams.get("dateTo") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") || "15", 10)));

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      OR: [
        { assigneeId: session.user.id },
        { assignments: { some: { userId: session.user.id } } },
        {
          service: {
            executors: {
              some: { userId: session.user.id }
            }
          }
        }
      ],
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
      // Wrap existing OR (user assignment) with AND to combine with search OR
      const userConditions = where.OR;
      delete where.OR;
      where.AND = [
        { OR: userConditions },
        { OR: [
          { title: { contains: search } },
          { project: { name: { contains: search } } },
        ]},
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
                  tasks: { select: { id: true, status: true, order: true, assigneeId: true } }
                },
                orderBy: { createdAt: "asc" }
              }
            },
          },
          service: { select: { id: true, name: true } },
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

    const computeCanStart = (task: any): { canStart: boolean; blockReason: string | null } => {
      // Check payment lock first
      if (task.linkedInstallment?.isLocked) {
        return { canStart: false, blockReason: "payment" };
      }

      const project = task.project;
      if (!project || !task.serviceId) return { canStart: true, blockReason: null };

      const services = project.services || [];
      const currentServiceIdx = services.findIndex((s: any) => s.id === task.serviceId);

      // Check previous service is fully done
      if (currentServiceIdx > 0) {
        const prevService = services[currentServiceIdx - 1];
        const allPrevDone = prevService.tasks.every((t: any) => t.status === "DONE");
        if (!allPrevDone) return { canStart: false, blockReason: "sequential" };
      }

      // Check previous tasks in same service are done
      const currentService = services[currentServiceIdx];
      if (currentService) {
        const prevTasks = currentService.tasks.filter((t: any) => t.order < task.order);
        const allPrevDone = prevTasks.every((t: any) => t.status === "DONE");
        if (!allPrevDone) return { canStart: false, blockReason: "sequential" };
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

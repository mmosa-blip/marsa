import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { countWorkingDays } from "@/lib/working-days";
import { getEffectiveDeadline } from "@/lib/project-deadline";

// Maximum active tasks before an executor is considered "fully loaded".
// Used as the denominator for loadPercent.
const MAX_LOAD = 20;

// Statuses that count as "active" (not finished, not cancelled)
const ACTIVE_STATUSES = ["TODO", "WAITING", "IN_PROGRESS", "IN_REVIEW", "WAITING_EXTERNAL"] as const;

function initialsFor(name: string): string {
  const trimmed = (name || "").trim();
  if (!trimmed) return "—";
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2);
  return (parts[0][0] || "") + (parts[parts.length - 1][0] || "");
}

// GET /api/operations/overview
// Admin/Manager only. Returns:
//   - projects: id, name, department, progress%, taskStats (late/active/done)
//   - executors: id, name, initials, activeTasks, lateTasks, loadPercent
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const now = new Date();

    // ── Projects (with full service+task hierarchy for the tree view) ────
    const projects = await prisma.project.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        projectCode: true,
        createdAt: true,
        endDate: true,
        contractStartDate: true,
        contractEndDate: true,
        // Fallback: some projects store dates on the Contract relation
        // instead of the project-level fields (legacy creation paths).
        contract: {
          select: { startDate: true, endDate: true },
        },
        isPaused: true,
        pauses: {
          where: { endDate: null },
          orderBy: { startDate: "desc" },
          take: 1,
          select: { reason: true, startDate: true },
        },
        department: { select: { id: true, name: true, color: true } },
        services: {
          where: { deletedAt: null },
          select: {
            id: true,
            name: true,
            status: true,
            executors: {
              select: {
                userId: true,
                user: { select: { id: true, name: true, role: true } },
              },
            },
            // Escalation employees live on the ServiceTemplate (catalog
            // level), not on the per-project Service instance. We pull
            // them via the template relation so the operations room can
            // manage them inline and still write back through the
            // existing /api/service-catalog/templates/[id]/escalation
            // endpoints — serviceTemplateId is surfaced below.
            serviceTemplateId: true,
            serviceTemplate: {
              select: {
                escalationEmployees: {
                  orderBy: { priority: "asc" },
                  select: {
                    id: true,
                    priority: true,
                    user: { select: { id: true, name: true, role: true } },
                  },
                },
              },
            },
            tasks: {
              select: {
                id: true,
                title: true,
                status: true,
                dueDate: true,
                assignee: { select: { id: true, name: true } },
              },
              orderBy: { order: "asc" },
            },
          },
          orderBy: { serviceOrder: "asc" },
        },
      },
      // Default ordering is newest-first; the final row list is re-sorted
      // below by contractEndDate ascending so "closest to expiry" floats
      // to the top of the operations room.
      orderBy: { createdAt: "desc" },
    });

    const projectRows = projects.map((p) => {
      // Flatten the nested services to compute project-level taskStats once.
      const allTasks = p.services.flatMap((s) => s.tasks);
      const total = allTasks.length;
      const done = allTasks.filter((t) => t.status === "DONE").length;
      const active = allTasks.filter((t) => ACTIVE_STATUSES.includes(t.status as typeof ACTIVE_STATUSES[number])).length;
      const late = allTasks.filter(
        (t) =>
          t.dueDate &&
          new Date(t.dueDate) < now &&
          t.status !== "DONE" &&
          t.status !== "CANCELLED"
      ).length;
      // Working-days left until the effective deadline (earliest of
      // project.endDate, project.contractEndDate, contract.endDate). null
      // when the project has no deadline at all; 0 or negative values get
      // clamped to 0 so an overdue project surfaces as "0 يوم متبقي".
      // late === lateTasks at the project level; surfaced both inside
      // taskStats and at the top level for the dedicated badge in
      // OperationsRoomClient.
      const resolvedContractStart = p.contractStartDate || p.contract?.startDate || null;
      const resolvedContractEnd = p.contractEndDate || p.contract?.endDate || null;
      const contractEnd = getEffectiveDeadline(p);
      let daysRemaining: number | null = null;
      if (contractEnd) {
        if (contractEnd <= now) {
          daysRemaining = 0;
        } else {
          daysRemaining = countWorkingDays(now, contractEnd);
        }
      }

      const contractOverdue = !!(contractEnd && contractEnd <= now);
      const taskOverdue = late > 0;
      const hasMissingDates = !resolvedContractStart || !resolvedContractEnd;

      const currentPause = p.pauses[0];
      return {
        id: p.id,
        name: p.name,
        projectCode: p.projectCode,
        // Contract timeline
        contractStartDate: resolvedContractStart ? new Date(resolvedContractStart).toISOString() : null,
        contractEndDate: resolvedContractEnd ? new Date(resolvedContractEnd).toISOString() : null,
        // Execution timeline
        projectStartDate: p.createdAt.toISOString(),
        projectEndDate: p.endDate ? p.endDate.toISOString() : null,
        // Delay indicators
        daysRemaining,
        lateTasks: late,
        contractOverdue,
        taskOverdue,
        isOverdue: contractOverdue || taskOverdue,
        hasMissingDates,
        isPaused: p.isPaused,
        currentPause: currentPause
          ? { reason: currentPause.reason, startDate: currentPause.startDate.toISOString() }
          : null,
        department: p.department
          ? { id: p.department.id, name: p.department.name, color: p.department.color }
          : null,
        progress: total > 0 ? Math.round((done / total) * 100) : 0,
        taskStats: { late, active, done },
        services: p.services.map((s) => {
          // Distinct executors derived from this service's task assignees
          // (preserves first-occurrence order via Map insertion).
          const seen = new Map<string, string>();
          for (const t of s.tasks) {
            if (t.assignee && !seen.has(t.assignee.id)) {
              seen.set(t.assignee.id, t.assignee.name);
            }
          }
          const executors = Array.from(seen, ([id, name]) => ({ id, name }));

          // Qualified employees = UserService rows for this service instance.
          // This is the authoritative pool the assignment room adds/removes
          // against — /api/projects/route.ts already uses these rows as the
          // fallback executor pool when the service template has none.
          const qualifiedEmployees = s.executors
            .filter((e) => e.user)
            .map((e) => ({
              id: e.user!.id,
              name: e.user!.name,
              role: e.user!.role,
            }));

          const escalationEmployees = (s.serviceTemplate?.escalationEmployees ?? []).map((e) => ({
            id: e.id,
            priority: e.priority,
            user: e.user,
          }));

          return {
            id: s.id,
            name: s.name,
            status: s.status,
            serviceTemplateId: s.serviceTemplateId,
            executors,
            qualifiedEmployees,
            escalationEmployees,
            tasks: s.tasks.map((t) => ({
              id: t.id,
              title: t.title,
              status: t.status,
              dueDate: t.dueDate ? t.dueDate.toISOString() : null,
              assignee: t.assignee ? { id: t.assignee.id, name: t.assignee.name } : null,
            })),
          };
        }),
      };
    });

    // Sort by contractEndDate ascending — rows without a contractEndDate
    // sink to the bottom. Within rows that share the "no end date"
    // bucket, the query's createdAt desc order survives because
    // Array.prototype.sort is stable in modern Node.
    projectRows.sort((a, b) => {
      if (a.contractEndDate && b.contractEndDate) {
        return new Date(a.contractEndDate).getTime() - new Date(b.contractEndDate).getTime();
      }
      if (a.contractEndDate) return -1;
      if (b.contractEndDate) return 1;
      return 0;
    });

    // ── Executors ─────────────────────────────────────────────────────────
    // Include EXECUTOR plus admins/managers (they may pick up tasks too).
    const executors = await prisma.user.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        role: { in: ["EXECUTOR", "ADMIN", "MANAGER"] },
      },
      select: {
        id: true,
        name: true,
        role: true,
      },
      orderBy: { name: "asc" },
    });

    const executorIds = executors.map((u) => u.id);

    // Aggregate active + late counts per assignee in one query each
    const activeGroup = await prisma.task.groupBy({
      by: ["assigneeId"],
      where: {
        assigneeId: { in: executorIds },
        status: { in: [...ACTIVE_STATUSES] },
        project: { deletedAt: null },
      },
      _count: { _all: true },
    });
    const lateGroup = await prisma.task.groupBy({
      by: ["assigneeId"],
      where: {
        assigneeId: { in: executorIds },
        status: { notIn: ["DONE", "CANCELLED"] },
        dueDate: { lt: now },
        project: { deletedAt: null },
      },
      _count: { _all: true },
    });

    const activeMap = new Map<string, number>();
    for (const g of activeGroup) if (g.assigneeId) activeMap.set(g.assigneeId, g._count._all);
    const lateMap = new Map<string, number>();
    for (const g of lateGroup) if (g.assigneeId) lateMap.set(g.assigneeId, g._count._all);

    const executorRows = executors.map((u) => {
      const activeTasks = activeMap.get(u.id) ?? 0;
      const lateTasks = lateMap.get(u.id) ?? 0;
      const loadPercent = Math.min(100, Math.round((activeTasks / MAX_LOAD) * 100));
      return {
        id: u.id,
        name: u.name,
        initials: initialsFor(u.name),
        activeTasks,
        lateTasks,
        loadPercent,
      };
    });

    return NextResponse.json({ projects: projectRows, executors: executorRows });
  } catch (error) {
    console.error("operations/overview error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

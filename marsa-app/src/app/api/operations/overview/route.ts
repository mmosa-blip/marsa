import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

    // ── Projects ──────────────────────────────────────────────────────────
    const projects = await prisma.project.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        department: { select: { id: true, name: true, color: true } },
        tasks: {
          select: { id: true, status: true, dueDate: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const projectRows = projects.map((p) => {
      const total = p.tasks.length;
      const done = p.tasks.filter((t) => t.status === "DONE").length;
      const active = p.tasks.filter((t) => ACTIVE_STATUSES.includes(t.status as typeof ACTIVE_STATUSES[number])).length;
      const late = p.tasks.filter(
        (t) =>
          t.dueDate &&
          new Date(t.dueDate) < now &&
          t.status !== "DONE" &&
          t.status !== "CANCELLED"
      ).length;
      return {
        id: p.id,
        name: p.name,
        department: p.department
          ? { id: p.department.id, name: p.department.name, color: p.department.color }
          : null,
        progress: total > 0 ? Math.round((done / total) * 100) : 0,
        taskStats: { late, active, done },
      };
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

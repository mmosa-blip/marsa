import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { logger } from "@/lib/logger";
import {
  getBuildingState,
  isProjectComplete,
  deriveProjectPaymentFrozen,
  type BuildingState,
} from "@/lib/city-state";

// GET /api/admin/cities-leaderboard
//
// Per-executor scorecard for the admin "ترتيب المدن" page. For every
// EXECUTOR we surface:
//   - completedCount, inProgressCount, taskLateCount, atRiskCount,
//     collapsedCount  (one bucket per BuildingState, mutually exclusive)
//   - totalProjects
//   - cityHealth (0-100, clamped) — weighted score that rewards delivery
//     and penalises lateness
//   - rank — 1-based position after sorting by cityHealth desc
//
// Buckets and the formula are kept in lock-step with the canvas so the
// admin's table never disagrees with what they see on /dashboard/all-cities.
//
// Auth: ADMIN / MANAGER only.
export async function GET() {
  try {
    await requireRole(["ADMIN", "MANAGER"]);

    // Pull every active project with the same shape /api/admin/all-cities
    // uses, so we can run getBuildingState on each. Soft-deleted projects
    // and services are excluded.
    const projects = await prisma.project.findMany({
      where: { deletedAt: null },
      include: {
        services: {
          where: { deletedAt: null },
          select: {
            id: true,
            tasks: { select: { id: true, status: true, dueDate: true } },
          },
        },
        tasks: {
          select: {
            id: true,
            status: true,
            dueDate: true,
            assigneeId: true,
            assignee: { select: { id: true, name: true } },
            linkedInstallment: {
              select: { isLocked: true, order: true, paymentStatus: true },
            },
          },
        },
      },
    });

    // Build executor → set of project IDs assigned to them.
    interface ExecutorRow {
      id: string;
      name: string;
      projectIds: Set<string>;
    }
    const execMap = new Map<string, ExecutorRow>();
    for (const p of projects) {
      for (const t of p.tasks) {
        if (!t.assignee?.id) continue;
        const existing = execMap.get(t.assignee.id);
        if (existing) {
          existing.projectIds.add(p.id);
        } else {
          execMap.set(t.assignee.id, {
            id: t.assignee.id,
            name: t.assignee.name,
            projectIds: new Set([p.id]),
          });
        }
      }
    }

    // For each executor, walk their projects and bucket by lifecycle state.
    const rows = Array.from(execMap.values()).map((exec) => {
      const myProjects = projects.filter((p) => exec.projectIds.has(p.id));

      const counts: Record<BuildingState, number> = {
        COMPLETED: 0,
        IN_PROGRESS: 0,
        TASK_LATE: 0,
        AT_RISK: 0,
        ADMIN_PAUSED: 0,
        PAYMENT_FROZEN: 0,
        COLLAPSED: 0,
      };

      for (const p of myProjects) {
        const isComplete = isProjectComplete(p);
        const paymentFrozen = deriveProjectPaymentFrozen(p.tasks);
        const state = getBuildingState({ ...p, isComplete, paymentFrozen });
        counts[state]++;
      }

      const total = myProjects.length;
      // Health score (per project, then averaged so a 5-project city isn't
      // out-ranked by a 50-project one):
      //   + completed × 10
      //   + inProgress × 5
      //   − collapsed × 20    (deadline blown — executor's fault)
      //   − atRisk × 10
      //   − taskLate × 5
      //   − adminPaused × 2   (small penalty: not their fault, but not delivered either)
      //   ± paymentFrozen × 0 (zero — purely on the client)
      const raw =
        total > 0
          ? (counts.COMPLETED * 10 +
              counts.IN_PROGRESS * 5 -
              counts.COLLAPSED * 20 -
              counts.AT_RISK * 10 -
              counts.TASK_LATE * 5 -
              counts.ADMIN_PAUSED * 2) /
            total
          : 0;
      // Map raw score (~ -20 .. +10 in practice) into a 0-100 band so the
      // health bar reads as a percentage. raw=10 → 100, raw=0 → 50, raw=-10 → 0.
      const cityHealth = Math.max(0, Math.min(100, Math.round(50 + raw * 5)));

      return {
        id: exec.id,
        name: exec.name,
        completedCount: counts.COMPLETED,
        inProgressCount: counts.IN_PROGRESS,
        taskLateCount: counts.TASK_LATE,
        atRiskCount: counts.AT_RISK,
        adminPausedCount: counts.ADMIN_PAUSED,
        paymentFrozenCount: counts.PAYMENT_FROZEN,
        collapsedCount: counts.COLLAPSED,
        totalProjects: total,
        cityHealth,
      };
    });

    // Highest health wins; ties broken by raw completed count, then by
    // name (stable, locale-aware) so the order is deterministic.
    rows.sort(
      (a, b) =>
        b.cityHealth - a.cityHealth ||
        b.completedCount - a.completedCount ||
        a.name.localeCompare(b.name, "ar"),
    );
    const ranked = rows.map((r, i) => ({ ...r, rank: i + 1 }));

    return NextResponse.json({ leaderboard: ranked });
  } catch (e) {
    if (e instanceof Response) return e;
    logger.error("admin/cities-leaderboard error", e);
    return NextResponse.json({ error: "فشل تحميل ترتيب المدن" }, { status: 500 });
  }
}

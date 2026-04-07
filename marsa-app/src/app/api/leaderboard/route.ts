import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/leaderboard
// Returns all-time executor performance ranked by:
//   1. completedTasks (descending)
//   2. on-time percentage (descending) — tiebreaker
//
// Includes EXECUTOR users plus admins/managers who actually have completed
// tasks of their own (so the dashboard reflects everyone who ships work).
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

    // 1. All staff users that can be ranked
    const users = await prisma.user.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        role: { in: ["EXECUTOR", "ADMIN", "MANAGER"] },
      },
      select: { id: true, name: true, role: true },
    });

    if (users.length === 0) {
      return NextResponse.json({ rows: [] });
    }

    const userIds = users.map((u) => u.id);

    // 2. Aggregate task time summaries per assignee for completed tasks
    // Pull TaskTimeSummary joined with task so we can read assigneeId.
    const summaries = await prisma.taskTimeSummary.findMany({
      where: {
        completedAt: { not: null },
        task: {
          assigneeId: { in: userIds },
          status: "DONE",
          project: { deletedAt: null },
        },
      },
      select: {
        executionDuration: true,
        isLate: true,
        task: { select: { assigneeId: true } },
      },
    });

    // 3. Tasks completed without a TaskTimeSummary record (legacy data) —
    // include them in the count so old completions still register.
    const fallbackCounts = await prisma.task.groupBy({
      by: ["assigneeId"],
      where: {
        assigneeId: { in: userIds },
        status: "DONE",
        timeSummary: null,
        project: { deletedAt: null },
      },
      _count: { _all: true },
    });

    type Acc = {
      completed: number;
      execMinutesSum: number;
      execMinutesCount: number;
      onTime: number;
      late: number;
    };
    const stats = new Map<string, Acc>();
    for (const id of userIds) {
      stats.set(id, { completed: 0, execMinutesSum: 0, execMinutesCount: 0, onTime: 0, late: 0 });
    }

    for (const s of summaries) {
      const uid = s.task?.assigneeId;
      if (!uid) continue;
      const acc = stats.get(uid);
      if (!acc) continue;
      acc.completed++;
      if (s.executionDuration != null) {
        acc.execMinutesSum += s.executionDuration;
        acc.execMinutesCount++;
      }
      if (s.isLate) acc.late++;
      else acc.onTime++;
    }
    for (const fc of fallbackCounts) {
      if (!fc.assigneeId) continue;
      const acc = stats.get(fc.assigneeId);
      if (!acc) continue;
      acc.completed += fc._count._all;
      // No timing data → count as on-time so legacy rows don't unfairly penalize
      acc.onTime += fc._count._all;
    }

    // 4. Build the response rows
    const rows = users.map((u) => {
      const acc = stats.get(u.id)!;
      const totalReviewed = acc.onTime + acc.late;
      const onTimePct = totalReviewed > 0 ? Math.round((acc.onTime / totalReviewed) * 100) : 0;
      const avgExecHours =
        acc.execMinutesCount > 0
          ? +(acc.execMinutesSum / acc.execMinutesCount / 60).toFixed(1)
          : 0;
      return {
        id: u.id,
        name: u.name,
        role: u.role,
        completedTasks: acc.completed,
        avgExecutionHours: avgExecHours,
        onTimePercentage: onTimePct,
      };
    });

    // 5. Drop users with zero completed tasks unless they're the current user
    // (so executors with nothing yet still see themselves on the board).
    const filtered = rows.filter(
      (r) => r.completedTasks > 0 || r.id === session.user.id
    );

    // 6. Sort: most completed first, on-time % as tiebreaker
    filtered.sort((a, b) => {
      if (b.completedTasks !== a.completedTasks) return b.completedTasks - a.completedTasks;
      return b.onTimePercentage - a.onTimePercentage;
    });

    return NextResponse.json({
      rows: filtered.map((r, i) => ({ ...r, rank: i + 1 })),
      currentUserId: session.user.id,
    });
  } catch (error) {
    console.error("Leaderboard error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

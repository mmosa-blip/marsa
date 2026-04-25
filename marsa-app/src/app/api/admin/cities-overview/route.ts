import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { logger } from "@/lib/logger";

// GET /api/admin/cities-overview
//
// Aggregated read-only view across every executor's "city" (their set
// of assigned projects). Returns one row per active executor with the
// counts the admin landing card needs:
//   - projectCount  — distinct projects the executor has tasks in
//   - activeProjects — same, filtered to ACTIVE/ON_HOLD
//   - totalTasks    — non-terminal tasks they own
//   - doneTasks     — DONE tasks they own (lifetime)
//   - lastActivityAt — most recent task.updatedAt (Task has no completedAt)
export async function GET() {
  try {
    await requireRole(["ADMIN", "MANAGER"]);

    const executors = await prisma.user.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        role: { in: ["EXECUTOR", "EXTERNAL_PROVIDER"] },
      },
      select: {
        id: true,
        name: true,
        avatar: true,
        role: true,
        specialization: true,
        assignedTasks: {
          where: { deletedAt: null },
          select: {
            id: true,
            status: true,
            updatedAt: true,
            projectId: true,
            project: { select: { id: true, status: true } },
          },
        },
      },
    });

    const cities = executors.map((u) => {
      const tasks = u.assignedTasks ?? [];
      const projectIds = new Set<string>();
      const activeProjectIds = new Set<string>();
      let doneTasks = 0;
      let lastActivityAt: Date | null = null;
      for (const t of tasks) {
        if (t.projectId) projectIds.add(t.projectId);
        if (t.project && (t.project.status === "ACTIVE" || t.project.status === "ON_HOLD")) {
          activeProjectIds.add(t.project.id);
        }
        if (t.status === "DONE") doneTasks += 1;
        if (t.updatedAt && (!lastActivityAt || t.updatedAt > lastActivityAt)) {
          lastActivityAt = t.updatedAt;
        }
      }
      return {
        id: u.id,
        name: u.name,
        avatar: u.avatar,
        role: u.role,
        specialization: u.specialization,
        projectCount: projectIds.size,
        activeProjectCount: activeProjectIds.size,
        totalTasks: tasks.length,
        doneTasks,
        lastActivityAt,
      };
    });

    cities.sort((a, b) => {
      if (b.activeProjectCount !== a.activeProjectCount)
        return b.activeProjectCount - a.activeProjectCount;
      return (b.lastActivityAt?.getTime() ?? 0) - (a.lastActivityAt?.getTime() ?? 0);
    });

    return NextResponse.json({ cities });
  } catch (e) {
    if (e instanceof Response) return e;
    logger.error("cities-overview error", e);
    return NextResponse.json({ error: "فشل تحميل بيانات المدن" }, { status: 500 });
  }
}

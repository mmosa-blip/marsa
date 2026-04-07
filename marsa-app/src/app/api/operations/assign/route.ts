import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * NOTE: This file deliberately avoids `prisma.$transaction`. The runtime
 * connects to Supabase through the pgbouncer pooler in transaction mode,
 * which does not support Prisma's interactive transactions at all — they
 * fail or hang regardless of any timeout/maxWait settings.
 *
 * Instead, every assign action is broken into a sequence of independent,
 * idempotent statements. Each individual statement is atomic on the DB
 * side; if a request fails halfway through, retrying it from the start is
 * safe (every operation is upsert / updateMany / createMany+skipDuplicates).
 */

/**
 * Reassign tasks in a service to a user. The set of tasks that get touched
 * is intentionally restricted:
 *
 *   - tasks with `assigneeId IS NULL`  → reassigned (they had no owner)
 *   - tasks owned by an existing project executor → reassigned (the project's
 *     executor pool is being rebalanced)
 *   - tasks owned by anyone OUTSIDE the project executor pool (e.g. a manual
 *     direct assignment to Mohammed) → LEFT ALONE
 *
 * Runs as a sequence of independent statements — no transaction wrapper.
 * UserService linkage is intentionally done by the caller, not here.
 */
async function assignServiceTasksToUser(
  serviceId: string,
  userId: string,
  now: Date,
  projectExecutorIds: string[]
): Promise<{ tasksMoved: number; totalLinked: number }> {
  // 1. Pull the tasks we are allowed to touch — unassigned OR owned by a
  //    current project executor. Manual direct assignments to anyone outside
  //    that pool are skipped here so they remain untouched.
  const reassignable = await prisma.task.findMany({
    where: {
      serviceId,
      OR: [
        { assigneeId: null },
        ...(projectExecutorIds.length > 0
          ? [{ assigneeId: { in: projectExecutorIds } }]
          : []),
      ],
    },
    select: { id: true, assigneeId: true },
  });

  // Of those, the ones that were previously unassigned need fresh
  // TaskTimeLog ASSIGNED + TaskTimeSummary rows.
  const previouslyUnassigned = reassignable.filter((t) => t.assigneeId === null);

  if (reassignable.length > 0) {
    const ids = reassignable.map((t) => t.id);

    await prisma.task.updateMany({
      where: { id: { in: ids } },
      data: { assigneeId: userId, assignedAt: now },
    });

    if (previouslyUnassigned.length > 0) {
      const newIds = previouslyUnassigned.map((t) => t.id);

      await prisma.taskTimeLog.createMany({
        data: newIds.map((id) => ({
          taskId: id,
          userId,
          event: "ASSIGNED",
          timestamp: now,
        })),
      });

      // One batch insert with skipDuplicates instead of looping upserts.
      await prisma.taskTimeSummary.createMany({
        data: newIds.map((id) => ({ taskId: id, assignedAt: now })),
        skipDuplicates: true,
      });

      // Bump assignedAt on any rows that already existed.
      await prisma.taskTimeSummary.updateMany({
        where: { taskId: { in: newIds } },
        data: { assignedAt: now },
      });
    }
  }

  // 2. TaskAssignment row for the user against every reassignable task only —
  //    we don't add the user as a co-assignee on tasks owned by people outside
  //    the project executor pool, otherwise their queue would surface tasks
  //    they have no claim on.
  if (reassignable.length > 0) {
    await prisma.taskAssignment.createMany({
      data: reassignable.map((t) => ({ taskId: t.id, userId })),
      skipDuplicates: true,
    });
  }

  return { tasksMoved: reassignable.length, totalLinked: reassignable.length };
}

/**
 * The set of users currently linked to a project as executors. Used as the
 * "trusted pool" when deciding which task ownerships are safe to overwrite
 * during a project- or service-level reassignment.
 */
async function getProjectExecutorIds(projectId: string): Promise<string[]> {
  const services = await prisma.service.findMany({
    where: { projectId, deletedAt: null },
    select: { id: true },
  });
  if (services.length === 0) return [];
  const links = await prisma.userService.findMany({
    where: { serviceId: { in: services.map((s) => s.id) } },
    select: { userId: true },
    distinct: ["userId"],
  });
  return links.map((l) => l.userId);
}

// POST /api/operations/assign
// Body: { type: "project" | "service" | "task", targetId: string, userId: string }
//
// project → walks all services in the project, runs the per-service block
//           on each one. Every statement is independent (no transaction).
// service → runs the per-service block on a single service.
// task    → minimal — only flips Task.assigneeId + upserts TaskAssignment.
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const body = await request.json();
    const { type, targetId, userId } = body as {
      type?: string;
      targetId?: string;
      userId?: string;
    };

    if (!type || !targetId || !userId) {
      return NextResponse.json({ error: "type و targetId و userId مطلوبة" }, { status: 400 });
    }
    if (!["project", "service", "task"].includes(type)) {
      return NextResponse.json({ error: "type غير صالح" }, { status: 400 });
    }

    // Validate the user exists and is active
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isActive: true, deletedAt: true },
    });
    if (!user || !user.isActive || user.deletedAt) {
      return NextResponse.json({ error: "المستخدم غير موجود أو غير نشط" }, { status: 404 });
    }

    // ── PROJECT: walk every service in the project ──
    if (type === "project") {
      const project = await prisma.project.findUnique({
        where: { id: targetId },
        select: {
          id: true,
          deletedAt: true,
          services: { select: { id: true, deletedAt: true } },
        },
      });
      if (!project || project.deletedAt) {
        return NextResponse.json({ error: "المشروع غير موجود" }, { status: 404 });
      }

      const liveServices = project.services.filter((s) => !s.deletedAt);
      if (liveServices.length === 0) {
        return NextResponse.json({
          assigned: { type, targetId, userId, services: 0, tasksMoved: 0, totalLinked: 0 },
        });
      }

      // Snapshot the project's current executor pool BEFORE any UserService
      // upsert, then add the new user. The "trusted pool" used by every
      // service-level reassignment is this combined set, so previously-
      // unassigned tasks AND tasks owned by an existing project executor
      // get reassigned, while a manual direct assignment to someone outside
      // the pool (e.g. Mohammed) stays untouched.
      const baseExecutors = await getProjectExecutorIds(project.id);
      const projectExecutorIds = Array.from(new Set([...baseExecutors, userId]));

      let tasksMoved = 0;
      let totalLinked = 0;
      const now = new Date();

      // Per-service: independent statements, no transaction wrapper.
      // Each statement is idempotent so a retry from scratch is safe.
      for (const s of liveServices) {
        await prisma.userService.upsert({
          where: { userId_serviceId: { userId, serviceId: s.id } },
          create: { userId, serviceId: s.id },
          update: {},
        });
        const r = await assignServiceTasksToUser(s.id, userId, now, projectExecutorIds);
        tasksMoved += r.tasksMoved;
        totalLinked += r.totalLinked;
      }

      return NextResponse.json({
        assigned: {
          type,
          targetId,
          userId,
          services: liveServices.length,
          tasksMoved,
          totalLinked,
        },
      });
    }

    // ── SERVICE: single service, same sequence as one iteration above ──
    if (type === "service") {
      const service = await prisma.service.findUnique({
        where: { id: targetId },
        select: { id: true, projectId: true, deletedAt: true },
      });
      if (!service || service.deletedAt) {
        return NextResponse.json({ error: "الخدمة غير موجودة" }, { status: 404 });
      }

      // Same trusted-pool logic as the project branch — derive from the
      // parent project so a service-level assign respects the same fence.
      const baseExecutors = service.projectId ? await getProjectExecutorIds(service.projectId) : [];
      const projectExecutorIds = Array.from(new Set([...baseExecutors, userId]));

      await prisma.userService.upsert({
        where: { userId_serviceId: { userId, serviceId: service.id } },
        create: { userId, serviceId: service.id },
        update: {},
      });

      const summary = await assignServiceTasksToUser(
        service.id,
        userId,
        new Date(),
        projectExecutorIds
      );

      return NextResponse.json({ assigned: { type, targetId, userId, ...summary } });
    }

    // ── TASK: minimal — two independent statements ──
    if (type === "task") {
      const task = await prisma.task.findUnique({
        where: { id: targetId },
        select: { id: true },
      });
      if (!task) {
        return NextResponse.json({ error: "المهمة غير موجودة" }, { status: 404 });
      }

      await prisma.task.update({
        where: { id: targetId },
        data: { assigneeId: userId, assignedAt: new Date() },
      });
      await prisma.taskAssignment.upsert({
        where: { taskId_userId: { taskId: targetId, userId } },
        create: { taskId: targetId, userId },
        update: {},
      });

      return NextResponse.json({ assigned: { type, targetId, userId } });
    }

    return NextResponse.json({ error: "type غير صالح" }, { status: 400 });
  } catch (error) {
    console.error("operations/assign error:", error);
    const msg = error instanceof Error ? error.message : "حدث خطأ";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

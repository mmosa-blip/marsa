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
 * Reassign tasks in a service to one or more users (round-robin).
 *
 * The set of tasks that get touched is intentionally restricted:
 *   - tasks with `assigneeId IS NULL`  → distributed (they had no owner)
 *   - tasks owned by an existing project executor → redistributed (the
 *     project's executor pool is being rebalanced)
 *   - tasks owned by anyone OUTSIDE the project executor pool (e.g. a manual
 *     direct assignment) → LEFT ALONE
 *
 * Distribution: tasks are dealt out in order across `userIds` (i % N), so
 * each selected user gets a roughly equal share. With a single user this
 * collapses to "assign everything to that user".
 *
 * Runs as a sequence of independent statements — no transaction wrapper.
 * UserService linkage for every selected user is done here.
 */
async function assignServiceTasksToUsers(
  serviceId: string,
  userIds: string[],
  now: Date,
  projectExecutorIds: string[]
): Promise<{ tasksMoved: number; totalLinked: number }> {
  if (userIds.length === 0) return { tasksMoved: 0, totalLinked: 0 };

  // 1. UserService linkage for every selected user.
  for (const uid of userIds) {
    await prisma.userService.upsert({
      where: { userId_serviceId: { userId: uid, serviceId } },
      create: { userId: uid, serviceId },
      update: {},
    });
  }

  // 2. Pull the tasks we are allowed to touch — unassigned OR owned by a
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
    orderBy: { order: "asc" },
  });

  // 3. Round-robin distribution: bucket task ids by destination user.
  const buckets = new Map<string, string[]>();
  for (const uid of userIds) buckets.set(uid, []);
  reassignable.forEach((t, i) => {
    const uid = userIds[i % userIds.length];
    buckets.get(uid)!.push(t.id);
  });

  // 4. Per-bucket: one updateMany + ASSIGNED time logs + time summaries.
  //    Auto-accept system-assigned tasks (per the principle from commit 2ac48bf).
  const previouslyUnassignedSet = new Set(
    reassignable.filter((t) => t.assigneeId === null).map((t) => t.id)
  );

  for (const [uid, taskIds] of buckets.entries()) {
    if (taskIds.length === 0) continue;

    await prisma.task.updateMany({
      where: { id: { in: taskIds } },
      data: { assigneeId: uid, assignedAt: now, acceptedAt: now },
    });

    // Only previously-unassigned tasks need fresh ASSIGNED logs + summaries.
    const newIds = taskIds.filter((id) => previouslyUnassignedSet.has(id));
    if (newIds.length > 0) {
      await prisma.taskTimeLog.createMany({
        data: newIds.map((id) => ({
          taskId: id,
          userId: uid,
          event: "ASSIGNED",
          timestamp: now,
        })),
      });
      await prisma.taskTimeSummary.createMany({
        data: newIds.map((id) => ({ taskId: id, assignedAt: now })),
        skipDuplicates: true,
      });
      await prisma.taskTimeSummary.updateMany({
        where: { taskId: { in: newIds } },
        data: { assignedAt: now },
      });
    }
  }

  // 5. TaskAssignment: every reassignable task gets a row for EVERY selected
  //    user. This is what makes "multi-executor" meaningful at the data layer
  //    — even though only one user owns assigneeId at a time, the task is
  //    visible in the audit/permission graph for all collaborators.
  if (reassignable.length > 0) {
    await prisma.taskAssignment.createMany({
      data: reassignable.flatMap((t) =>
        userIds.map((uid) => ({ taskId: t.id, userId: uid }))
      ),
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
// Body: { type: "project" | "service" | "task", targetId: string,
//         userIds: string[] }              ← preferred (multi-executor)
//       { ..., userId: string }            ← backward compat (single)
//
// project → walks all services in the project, runs the per-service block
//           on each one with the FULL userIds array (round-robin distribution
//           per service). Every statement is independent (no transaction).
// service → runs the per-service block on a single service.
// task    → first userId becomes Task.assigneeId; all selected userIds get
//           TaskAssignment rows so they appear as collaborators in the
//           operations-room avatar stack.
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const body = await request.json();
    const { type, targetId } = body as { type?: string; targetId?: string };

    // Accept either userIds (preferred) or userId (legacy single).
    const rawUserIds = Array.isArray((body as { userIds?: unknown }).userIds)
      ? ((body as { userIds: unknown[] }).userIds as unknown[]).filter(
          (x): x is string => typeof x === "string" && x.length > 0
        )
      : typeof (body as { userId?: unknown }).userId === "string"
        ? [(body as { userId: string }).userId]
        : [];
    // Dedupe while preserving order.
    const userIds = Array.from(new Set(rawUserIds));

    if (!type || !targetId || userIds.length === 0) {
      return NextResponse.json(
        { error: "type و targetId و userIds مطلوبة" },
        { status: 400 }
      );
    }
    if (!["project", "service", "task"].includes(type)) {
      return NextResponse.json({ error: "type غير صالح" }, { status: 400 });
    }

    // Validate every user exists and is active.
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, isActive: true, deletedAt: true },
    });
    if (users.length !== userIds.length) {
      return NextResponse.json(
        { error: "أحد المستخدمين غير موجود" },
        { status: 404 }
      );
    }
    const inactive = users.find((u) => !u.isActive || u.deletedAt);
    if (inactive) {
      return NextResponse.json(
        { error: "أحد المستخدمين غير نشط" },
        { status: 404 }
      );
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
          assigned: { type, targetId, userIds, services: 0, tasksMoved: 0, totalLinked: 0 },
        });
      }

      // Snapshot the project's current executor pool BEFORE any UserService
      // upsert, then add the new users. The "trusted pool" used by every
      // service-level reassignment is this combined set, so previously-
      // unassigned tasks AND tasks owned by an existing project executor
      // get reassigned, while a manual direct assignment to someone outside
      // the pool stays untouched.
      const baseExecutors = await getProjectExecutorIds(project.id);
      const projectExecutorIds = Array.from(new Set([...baseExecutors, ...userIds]));

      let tasksMoved = 0;
      let totalLinked = 0;
      const now = new Date();

      for (const s of liveServices) {
        const r = await assignServiceTasksToUsers(s.id, userIds, now, projectExecutorIds);
        tasksMoved += r.tasksMoved;
        totalLinked += r.totalLinked;
      }

      return NextResponse.json({
        assigned: {
          type,
          targetId,
          userIds,
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
      const baseExecutors = service.projectId
        ? await getProjectExecutorIds(service.projectId)
        : [];
      const projectExecutorIds = Array.from(new Set([...baseExecutors, ...userIds]));

      const summary = await assignServiceTasksToUsers(
        service.id,
        userIds,
        new Date(),
        projectExecutorIds
      );

      return NextResponse.json({ assigned: { type, targetId, userIds, ...summary } });
    }

    // ── TASK: first user becomes the primary assignee (Task.assigneeId);
    //         all selected users get TaskAssignment rows (collaborators).
    //         The "primary" is the one whose queue actually surfaces the
    //         task — the rest are co-owners visible in the avatar stack.
    if (type === "task") {
      const task = await prisma.task.findUnique({
        where: { id: targetId },
        select: { id: true },
      });
      if (!task) {
        return NextResponse.json({ error: "المهمة غير موجودة" }, { status: 404 });
      }

      const taskNow = new Date();
      const primaryUserId = userIds[0];

      // Auto-accept — same principle as the project/service paths above.
      await prisma.task.update({
        where: { id: targetId },
        data: { assigneeId: primaryUserId, assignedAt: taskNow, acceptedAt: taskNow },
      });

      // Every selected user gets a TaskAssignment row.
      await prisma.taskAssignment.createMany({
        data: userIds.map((uid) => ({ taskId: targetId, userId: uid })),
        skipDuplicates: true,
      });

      return NextResponse.json({ assigned: { type, targetId, userIds } });
    }

    return NextResponse.json({ error: "type غير صالح" }, { status: 400 });
  } catch (error) {
    console.error("operations/assign error:", error);
    const msg = error instanceof Error ? error.message : "حدث خطأ";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

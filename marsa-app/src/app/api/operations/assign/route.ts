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
 * Move every previously-unassigned task in a service to a user, and ensure
 * a TaskAssignment row exists for the user against EVERY task in the service.
 *
 * Runs as a sequence of independent statements — no transaction wrapper.
 *
 * UserService linkage is intentionally NOT done here; the caller does it
 * as a separate top-level statement so the helper stays focused.
 */
async function assignServiceTasksToUser(
  serviceId: string,
  userId: string,
  now: Date
): Promise<{ unassignedMoved: number; totalLinked: number }> {
  // 1. Tasks that don't have an assignee yet — these become the user's,
  //    plus need a TaskTimeLog ASSIGNED entry and a TaskTimeSummary row.
  const unassigned = await prisma.task.findMany({
    where: { serviceId, assigneeId: null },
    select: { id: true },
  });

  if (unassigned.length > 0) {
    const ids = unassigned.map((t) => t.id);

    await prisma.task.updateMany({
      where: { id: { in: ids } },
      data: { assigneeId: userId, assignedAt: now },
    });

    await prisma.taskTimeLog.createMany({
      data: ids.map((id) => ({
        taskId: id,
        userId,
        event: "ASSIGNED",
        timestamp: now,
      })),
    });

    // Create a summary row for any task that doesn't have one yet (single
    // batch query, skips duplicates instead of looping upserts).
    await prisma.taskTimeSummary.createMany({
      data: ids.map((id) => ({ taskId: id, assignedAt: now })),
      skipDuplicates: true,
    });

    // For tasks that already had a summary, bump assignedAt to now so the
    // metric reflects the latest assignment.
    await prisma.taskTimeSummary.updateMany({
      where: { taskId: { in: ids } },
      data: { assignedAt: now },
    });
  }

  // 2. TaskAssignment row for the user against every task in the service.
  //    createMany + skipDuplicates is equivalent to N upserts with `update: {}`.
  const allTasks = await prisma.task.findMany({
    where: { serviceId },
    select: { id: true },
  });
  if (allTasks.length > 0) {
    await prisma.taskAssignment.createMany({
      data: allTasks.map((t) => ({ taskId: t.id, userId })),
      skipDuplicates: true,
    });
  }

  return { unassignedMoved: unassigned.length, totalLinked: allTasks.length };
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
          assigned: { type, targetId, userId, services: 0, unassignedMoved: 0, totalLinked: 0 },
        });
      }

      let unassignedMoved = 0;
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
        const r = await assignServiceTasksToUser(s.id, userId, now);
        unassignedMoved += r.unassignedMoved;
        totalLinked += r.totalLinked;
      }

      return NextResponse.json({
        assigned: {
          type,
          targetId,
          userId,
          services: liveServices.length,
          unassignedMoved,
          totalLinked,
        },
      });
    }

    // ── SERVICE: single service, same sequence as one iteration above ──
    if (type === "service") {
      const service = await prisma.service.findUnique({
        where: { id: targetId },
        select: { id: true, deletedAt: true },
      });
      if (!service || service.deletedAt) {
        return NextResponse.json({ error: "الخدمة غير موجودة" }, { status: 404 });
      }

      await prisma.userService.upsert({
        where: { userId_serviceId: { userId, serviceId: service.id } },
        create: { userId, serviceId: service.id },
        update: {},
      });

      const summary = await assignServiceTasksToUser(service.id, userId, new Date());

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

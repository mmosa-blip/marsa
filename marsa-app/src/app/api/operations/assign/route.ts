import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { PrismaClient } from "@/generated/prisma/client";

// Prisma transaction client type — convenient alias for the helpers
type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

/**
 * Assign one Service to one user end-to-end. Mirrors the logic in
 * /api/users/[id]/services POST so the two paths stay in sync:
 *   1. Upsert UserService link
 *   2. Move every previously-unassigned Task in the service to the user
 *      (Task.assigneeId + assignedAt)
 *   3. Write TaskTimeLog ASSIGNED + initial TaskTimeSummary for those tasks
 *   4. Upsert TaskAssignment for ALL tasks in the service (not just the
 *      previously unassigned ones), so the executor sees them in their queue
 */
async function assignServiceToUser(tx: Tx, serviceId: string, userId: string) {
  await tx.userService.upsert({
    where: { userId_serviceId: { userId, serviceId } },
    create: { userId, serviceId },
    update: {},
  });

  const unassignedTasks = await tx.task.findMany({
    where: { serviceId, assigneeId: null },
    select: { id: true },
  });

  if (unassignedTasks.length > 0) {
    const now = new Date();
    await tx.task.updateMany({
      where: { serviceId, assigneeId: null },
      data: { assigneeId: userId, assignedAt: now },
    });
    await tx.taskTimeLog.createMany({
      data: unassignedTasks.map((t) => ({
        taskId: t.id,
        userId,
        event: "ASSIGNED",
        timestamp: now,
      })),
    });
    for (const t of unassignedTasks) {
      await tx.taskTimeSummary.upsert({
        where: { taskId: t.id },
        create: { taskId: t.id, assignedAt: now },
        update: { assignedAt: now },
      });
    }
  }

  // Ensure TaskAssignment rows exist for every task in the service
  const allTasks = await tx.task.findMany({
    where: { serviceId },
    select: { id: true },
  });
  for (const task of allTasks) {
    await tx.taskAssignment.upsert({
      where: { taskId_userId: { taskId: task.id, userId } },
      create: { taskId: task.id, userId },
      update: {},
    });
  }

  return { unassignedMoved: unassignedTasks.length, totalLinked: allTasks.length };
}

// POST /api/operations/assign
// Body: { type: "project" | "service" | "task", targetId: string, userId: string }
//
// project → walks all services in the project and runs assignServiceToUser on each
// service → assignServiceToUser for one service
// task    → only flips Task.assigneeId + upserts TaskAssignment (no UserService write)
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
          assigned: { type, targetId, userId, services: 0, tasks: 0 },
        });
      }

      const summary = await prisma.$transaction(async (tx) => {
        let unassignedMoved = 0;
        let totalLinked = 0;
        for (const s of liveServices) {
          const r = await assignServiceToUser(tx as unknown as Tx, s.id, userId);
          unassignedMoved += r.unassignedMoved;
          totalLinked += r.totalLinked;
        }
        return { services: liveServices.length, unassignedMoved, totalLinked };
      });

      return NextResponse.json({ assigned: { type, targetId, userId, ...summary } });
    }

    // ── SERVICE: same logic as /api/users/[id]/services POST ──
    if (type === "service") {
      const service = await prisma.service.findUnique({
        where: { id: targetId },
        select: { id: true, deletedAt: true },
      });
      if (!service || service.deletedAt) {
        return NextResponse.json({ error: "الخدمة غير موجودة" }, { status: 404 });
      }

      const summary = await prisma.$transaction(async (tx) => {
        return assignServiceToUser(tx as unknown as Tx, service.id, userId);
      });

      return NextResponse.json({ assigned: { type, targetId, userId, ...summary } });
    }

    // ── TASK: minimal — only flip assigneeId + upsert TaskAssignment ──
    if (type === "task") {
      const task = await prisma.task.findUnique({
        where: { id: targetId },
        select: { id: true },
      });
      if (!task) {
        return NextResponse.json({ error: "المهمة غير موجودة" }, { status: 404 });
      }

      await prisma.$transaction(async (tx) => {
        await tx.task.update({
          where: { id: targetId },
          data: { assigneeId: userId, assignedAt: new Date() },
        });
        await tx.taskAssignment.upsert({
          where: { taskId_userId: { taskId: targetId, userId } },
          create: { taskId: targetId, userId },
          update: {},
        });
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

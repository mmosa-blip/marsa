import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || !["ADMIN", "MANAGER"].includes(session.user.role)) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }
  const { id } = await params;
  const userServices = await prisma.userService.findMany({
    where: { userId: id },
    include: { service: { select: { id: true, name: true, category: true } } },
  });
  return NextResponse.json(userServices);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || !["ADMIN", "MANAGER"].includes(session.user.role)) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }
  const { id } = await params;
  const { serviceId } = await request.json();
  const userService = await prisma.userService.upsert({
    where: { userId_serviceId: { userId: id, serviceId } },
    create: { userId: id, serviceId },
    update: {},
  });

  // Auto-assign tasks linked to this service
  const unassignedTasks = await prisma.task.findMany({
    where: { serviceId, assigneeId: null },
    select: { id: true },
  });

  if (unassignedTasks.length > 0) {
    const now = new Date();
    await prisma.task.updateMany({
      where: { serviceId, assigneeId: null },
      data: { assigneeId: id, assignedAt: now },
    });

    // Create ASSIGNED time logs for each auto-assigned task
    await prisma.taskTimeLog.createMany({
      data: unassignedTasks.map((t) => ({
        taskId: t.id,
        userId: id,
        event: "ASSIGNED",
        timestamp: now,
      })),
    });

    // Create initial time summaries
    for (const t of unassignedTasks) {
      await prisma.taskTimeSummary.upsert({
        where: { taskId: t.id },
        create: { taskId: t.id, assignedAt: now },
        update: { assignedAt: now },
      });
    }
  }

  // Also create TaskAssignment for ALL tasks in this service (not just unassigned)
  const allServiceTasks = await prisma.task.findMany({
    where: { serviceId },
    select: { id: true },
  });
  for (const task of allServiceTasks) {
    await prisma.taskAssignment.upsert({
      where: { taskId_userId: { taskId: task.id, userId: id } },
      create: { taskId: task.id, userId: id },
      update: {},
    });
  }

  return NextResponse.json(userService, { status: 201 });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || !["ADMIN", "MANAGER"].includes(session.user.role)) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }
  const { id } = await params;
  const { serviceId } = await request.json();
  await prisma.userService.deleteMany({ where: { userId: id, serviceId } });
  return NextResponse.json({ message: "تم إلغاء ربط الخدمة" });
}

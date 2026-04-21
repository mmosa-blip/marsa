import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";

const INACTIVE_STATUSES = ["DONE", "CANCELLED"];

/**
 * Redistribute unassigned/orphaned tasks across qualified employees for a service template.
 * Only touches active tasks (not DONE/CANCELLED).
 */
async function redistributeTasks(serviceTemplateId: string) {
  // Get all current qualified employees for this template
  const qualifiedEmployees = await prisma.serviceTemplateEmployee.findMany({
    where: { serviceTemplateId },
    select: { userId: true },
  });
  const qualifiedIds = qualifiedEmployees.map((e) => e.userId);

  // Find all live Service instances linked to this template
  const services = await prisma.service.findMany({
    where: { serviceTemplateId },
    select: { id: true },
  });
  const serviceIds = services.map((s) => s.id);
  if (serviceIds.length === 0) return { updated: 0 };

  // Find active tasks that are unassigned OR assigned to someone no longer qualified
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const taskWhere: any = {
    serviceId: { in: serviceIds },
    status: { notIn: INACTIVE_STATUSES },
  };

  if (qualifiedIds.length > 0) {
    // Tasks where assigneeId is null OR not in the qualified list
    taskWhere.OR = [
      { assigneeId: null },
      { assigneeId: { notIn: qualifiedIds } },
    ];
  } else {
    // No qualified employees — only nullify tasks that have an assignee
    // (unassigned tasks stay as-is)
    taskWhere.assigneeId = { not: null };
  }

  const tasks = await prisma.task.findMany({
    where: taskWhere,
    select: { id: true, assigneeId: true },
    orderBy: { order: "asc" },
  });

  if (tasks.length === 0) return { updated: 0 };

  let updated = 0;

  if (qualifiedIds.length === 0) {
    // No qualified employees left — set assigneeId to null
    await prisma.task.updateMany({
      where: { id: { in: tasks.map((t) => t.id) } },
      data: { assigneeId: null },
    });
    updated = tasks.length;
  } else {
    // Round-robin distribute tasks among qualified employees
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      const newAssigneeId = qualifiedIds[i % qualifiedIds.length];

      // Skip if already correctly assigned
      if (task.assigneeId === newAssigneeId) continue;

      await prisma.task.update({
        where: { id: task.id },
        data: { assigneeId: newAssigneeId, assignedAt: new Date() },
      });

      // Ensure TaskAssignment exists
      await prisma.taskAssignment.upsert({
        where: { taskId_userId: { taskId: task.id, userId: newAssigneeId } },
        create: { taskId: task.id, userId: newAssigneeId },
        update: {},
      });

      updated++;
    }
  }

  return { updated };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["ADMIN", "MANAGER"]);

    const { id } = await params;

    const employees = await prisma.serviceTemplateEmployee.findMany({
      where: { serviceTemplateId: id },
      include: {
        user: { select: { id: true, name: true, role: true, email: true } },
      },
    });

    return NextResponse.json(employees);
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["ADMIN", "MANAGER"]);

    const { id } = await params;
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: "معرف المستخدم مطلوب" }, { status: 400 });
    }

    // Check template exists
    const template = await prisma.serviceTemplate.findUnique({ where: { id } });
    if (!template) {
      return NextResponse.json({ error: "قالب الخدمة غير موجود" }, { status: 404 });
    }

    // Check for duplicates
    const existing = await prisma.serviceTemplateEmployee.findUnique({
      where: { serviceTemplateId_userId: { serviceTemplateId: id, userId } },
    });

    if (existing) {
      return NextResponse.json({ error: "الموظف مضاف مسبقاً" }, { status: 409 });
    }

    const employee = await prisma.serviceTemplateEmployee.create({
      data: { serviceTemplateId: id, userId },
      include: { user: { select: { id: true, name: true, role: true, email: true } } },
    });

    // Redistribute active tasks across all qualified employees (including the new one)
    const { updated } = await redistributeTasks(id);

    return NextResponse.json({ ...employee, tasksRedistributed: updated }, { status: 201 });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["ADMIN", "MANAGER"]);

    const { id } = await params;

    // Support userId from body OR query params (some environments strip DELETE body)
    let userId: string | null = null;
    const queryUserId = new URL(request.url).searchParams.get("userId");
    if (queryUserId) {
      userId = queryUserId;
    } else {
      try {
        const body = await request.json();
        userId = body.userId || null;
      } catch {
        // body might be empty
      }
    }

    if (!userId) {
      return NextResponse.json({ error: "معرف المستخدم مطلوب" }, { status: 400 });
    }

    await prisma.serviceTemplateEmployee.delete({
      where: { serviceTemplateId_userId: { serviceTemplateId: id, userId } },
    });

    // Redistribute: reassign removed employee's tasks to remaining qualified employees
    const { updated } = await redistributeTasks(id);

    return NextResponse.json({ message: "تم إزالة الموظف بنجاح", tasksRedistributed: updated });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

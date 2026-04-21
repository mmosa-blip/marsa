import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/api-auth";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();

    const { id } = await params;
    const body = await request.json();

    // Assignee changes are admin-only as a general rule, with one exception:
    // an executor may claim an orphan task (assigneeId === null) by setting
    // it to themselves. This powers the "📋 التقط المهمة" button on
    // unassigned rows in project mode. Any other assignee mutation by a
    // non-admin is silently stripped.
    if (body.assigneeId !== undefined && !["ADMIN", "MANAGER"].includes(session.user.role)) {
      const claimingSelf = body.assigneeId === session.user.id;
      if (claimingSelf) {
        const current = await prisma.task.findUnique({
          where: { id },
          select: { assigneeId: true },
        });
        if (current?.assigneeId !== null) {
          // Already assigned to someone — non-admins can't reassign
          delete body.assigneeId;
        }
      } else {
        delete body.assigneeId;
      }
    }

    // Payment-task locking: block status changes if linked installment is locked
    if (body.status) {
      const existingTask = await prisma.task.findUnique({
        where: { id },
        include: { linkedInstallment: { select: { isLocked: true, paymentStatus: true, title: true } } },
      });

      if (existingTask?.linkedInstallment?.isLocked) {
        return NextResponse.json(
          { error: `المهمة محظورة حتى يتم دفع الدفعة: ${existingTask.linkedInstallment.title}` },
          { status: 403 }
        );
      }
    }

    // If assigneeId is being set manually, also create TaskAssignment record
    const manualAssign = body.assigneeId !== undefined && body.assigneeId !== null;
    if (manualAssign) {
      body.assignedAt = new Date();
    }

    const task = await prisma.task.update({
      where: { id },
      data: body,
      include: {
        service: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true } },
      },
    });

    // Sync TaskAssignment records with the new primary assignee
    if (manualAssign && task.assigneeId) {
      await prisma.taskAssignment.upsert({
        where: { taskId_userId: { taskId: id, userId: task.assigneeId } },
        create: { taskId: id, userId: task.assigneeId },
        update: {},
      });
    }

    return NextResponse.json(task);
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error updating task:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["ADMIN", "MANAGER"]);

    const { id } = await params;

    // Soft delete: set status to CANCELLED instead of hard delete
    await prisma.task.update({
      where: { id },
      data: { status: "CANCELLED" },
    });

    return NextResponse.json({ message: "تم حذف المهمة" });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error deleting task:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

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

    const task = await prisma.task.update({
      where: { id },
      data: body,
      include: {
        service: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(task);
  } catch (error) {
    console.error("Error updating task:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const { id } = await params;

    await prisma.task.delete({ where: { id } });

    return NextResponse.json({ message: "تم حذف المهمة" });
  } catch (error) {
    console.error("Error deleting task:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

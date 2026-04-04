import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const { id } = await params;

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        assignee: {
          select: {
            id: true,
            role: true,
            costPerTask: true,
          },
        },
      },
    });

    if (!task) {
      return NextResponse.json(
        { error: "المهمة غير موجودة" },
        { status: 404 }
      );
    }

    if (task.assigneeId !== session.user.id) {
      return NextResponse.json(
        { error: "لا يمكنك إكمال مهمة غير مسندة إليك" },
        { status: 403 }
      );
    }

    if (task.status === "DONE") {
      return NextResponse.json(
        { error: "المهمة مكتملة بالفعل" },
        { status: 400 }
      );
    }

    if (task.status === "CANCELLED") {
      return NextResponse.json(
        { error: "لا يمكن إكمال مهمة ملغاة" },
        { status: 400 }
      );
    }

    const isExternalProvider = task.assignee?.role === "EXTERNAL_PROVIDER";

    if (isExternalProvider) {
      const updatedTask = await prisma.$transaction(async (tx) => {
        const updated = await tx.task.update({
          where: { id },
          data: { status: "DONE" },
          include: {
            service: { select: { id: true, name: true } },
            project: { select: { id: true, name: true } },
          },
        });

        let taskCost = await tx.taskCost.findUnique({
          where: {
            taskId_providerId: {
              taskId: id,
              providerId: session.user.id,
            },
          },
        });

        if (!taskCost) {
          taskCost = await tx.taskCost.create({
            data: {
              taskId: id,
              providerId: session.user.id,
              amount: task.assignee?.costPerTask ?? 0,
            },
          });
        }

        const lastPaymentRequest = await tx.paymentRequest.findFirst({
          orderBy: { requestNumber: "desc" },
          select: { requestNumber: true },
        });

        let nextNumber = 1;
        if (lastPaymentRequest) {
          const match = lastPaymentRequest.requestNumber.match(/PAY-REQ-(\d+)/);
          if (match) {
            nextNumber = parseInt(match[1], 10) + 1;
          }
        }
        const requestNumber = `PAY-REQ-${String(nextNumber).padStart(4, "0")}`;

        await tx.paymentRequest.create({
          data: {
            requestNumber,
            amount: taskCost.amount,
            status: "PENDING_SUPERVISOR",
            providerId: session.user.id,
            requestedById: session.user.id,
            taskCostId: taskCost.id,
          },
        });

        return updated;
      });

      return NextResponse.json(updatedTask);
    }

    const updatedTask = await prisma.task.update({
      where: { id },
      data: { status: "DONE" },
      include: {
        service: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(updatedTask);
  } catch (error) {
    console.error("Error completing task:", error);
    return NextResponse.json(
      { error: "حدث خطأ في إكمال المهمة" },
      { status: 500 }
    );
  }
}

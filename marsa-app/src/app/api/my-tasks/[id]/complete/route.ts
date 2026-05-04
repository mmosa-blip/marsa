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

    // External-provider auto-payout (TaskCost + PaymentRequest creation)
    // removed alongside the deprecated payment-requests UI. Provider
    // settlements are now handled offline; the task simply transitions
    // to DONE like any other.
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

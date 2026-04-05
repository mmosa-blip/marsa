import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PATCH — mark payment as paid or update
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; scheduleId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const { scheduleId } = await params;
    const body = await request.json();

    const data: Record<string, unknown> = {};
    if (body.status === "PAID") {
      data.status = "PAID";
      data.paidDate = new Date();
    }
    if (body.amount !== undefined) data.amount = parseFloat(String(body.amount));
    if (body.dueDate !== undefined) data.dueDate = new Date(body.dueDate);
    if (body.label !== undefined) data.label = body.label;
    if (body.notes !== undefined) data.notes = body.notes;

    const updated = await prisma.projectPaymentSchedule.update({
      where: { id: scheduleId },
      data,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

// DELETE
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; scheduleId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const { scheduleId } = await params;
    await prisma.projectPaymentSchedule.delete({ where: { id: scheduleId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

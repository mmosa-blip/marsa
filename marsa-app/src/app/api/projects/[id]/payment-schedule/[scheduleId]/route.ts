import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";

// PATCH — mark payment as paid or update
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; scheduleId: string }> }
) {
  try {
    await requireRole(["ADMIN", "MANAGER"]);

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
    if (error instanceof Response) return error;
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
    await requireRole(["ADMIN", "MANAGER"]);

    const { scheduleId } = await params;
    await prisma.projectPaymentSchedule.delete({ where: { id: scheduleId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

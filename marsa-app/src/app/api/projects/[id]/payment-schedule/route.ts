import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/api-auth";

// GET — list payment schedule for a project
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();

    const { id } = await params;
    const schedule = await prisma.projectPaymentSchedule.findMany({
      where: { projectId: id },
      orderBy: { dueDate: "asc" },
    });

    return NextResponse.json(schedule);
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

// POST — add payment to schedule
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["ADMIN", "MANAGER"]);

    const { id } = await params;
    const body = await request.json();
    const { amount, dueDate, label, notes, gateForServiceOrder } = body;

    if (!amount || !dueDate) {
      return NextResponse.json({ error: "المبلغ وتاريخ الاستحقاق مطلوبين" }, { status: 400 });
    }

    const payment = await prisma.projectPaymentSchedule.create({
      data: {
        projectId: id,
        amount: parseFloat(String(amount)),
        dueDate: new Date(dueDate),
        label: label?.trim() || null,
        notes: notes?.trim() || null,
        gateForServiceOrder: gateForServiceOrder != null ? parseInt(String(gateForServiceOrder)) : null,
      },
    });

    return NextResponse.json(payment, { status: 201 });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

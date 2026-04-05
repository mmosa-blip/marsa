import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET — list payment schedule for a project
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

    const { id } = await params;
    const schedule = await prisma.projectPaymentSchedule.findMany({
      where: { projectId: id },
      orderBy: { dueDate: "asc" },
    });

    return NextResponse.json(schedule);
  } catch (error) {
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
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

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
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role === "CLIENT") {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const departmentId = new URL(request.url).searchParams.get("departmentId");
    const where: Record<string, unknown> = {};
    if (departmentId) where.departmentId = departmentId;

    const payments = await prisma.departmentPayment.findMany({
      where,
      select: { amount: true, paidAmount: true, status: true },
    });

    const totalDue = payments.reduce((s, p) => s + p.amount, 0);
    const totalPaid = payments.reduce((s, p) => s + p.paidAmount, 0);
    const totalRemaining = totalDue - totalPaid;
    const overdue = payments.filter((p) => p.status === "OVERDUE").reduce((s, p) => s + (p.amount - p.paidAmount), 0);
    const count = payments.length;

    return NextResponse.json({ totalDue, totalPaid, totalRemaining, overdue, count });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

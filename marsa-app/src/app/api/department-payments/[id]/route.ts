import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role === "CLIENT") {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const { id } = await params;
    const payment = await prisma.departmentPayment.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true, phone: true } },
        department: { select: { id: true, name: true, color: true } },
        project: { select: { id: true, name: true } },
        service: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        installments: { orderBy: { dueDate: "asc" } },
      },
    });

    if (!payment) return NextResponse.json({ error: "الدفعة غير موجودة" }, { status: 404 });
    return NextResponse.json(payment);
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }
    const { id } = await params;
    await prisma.departmentPayment.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

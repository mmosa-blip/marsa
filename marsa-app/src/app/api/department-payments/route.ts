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

    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get("departmentId");
    const status = searchParams.get("status");
    const clientId = searchParams.get("clientId");

    const where: Record<string, unknown> = {};
    if (departmentId) where.departmentId = departmentId;
    if (status) where.status = status;
    if (clientId) where.clientId = clientId;

    const payments = await prisma.departmentPayment.findMany({
      where,
      include: {
        client: { select: { id: true, name: true, phone: true } },
        department: { select: { id: true, name: true, color: true } },
        project: { select: { id: true, name: true } },
        service: { select: { id: true, name: true } },
        installments: { orderBy: { dueDate: "asc" } },
        _count: { select: { installments: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(payments);
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const body = await request.json();
    const {
      amount, departmentId, clientId, paymentMethod, paymentType,
      installmentCount, dueDate, notes, projectId, serviceId,
    } = body;

    if (!amount || !departmentId || !clientId) {
      return NextResponse.json({ error: "المبلغ والقسم والعميل مطلوبين" }, { status: 400 });
    }

    const parsedAmount = parseFloat(String(amount));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json({ error: "المبلغ غير صحيح" }, { status: 400 });
    }

    const payment = await prisma.departmentPayment.create({
      data: {
        amount: parsedAmount,
        departmentId,
        clientId,
        paymentMethod: paymentMethod || "BANK_TRANSFER",
        paymentType: paymentType || "FULL",
        installmentCount: paymentType === "INSTALLMENTS" ? (parseInt(String(installmentCount)) || 1) : 1,
        dueDate: dueDate ? new Date(dueDate) : null,
        notes: notes?.trim() || null,
        projectId: projectId || null,
        serviceId: serviceId || null,
        createdById: session.user.id,
      },
    });

    // Auto-create installments if type is INSTALLMENTS
    if (paymentType === "INSTALLMENTS" && installmentCount > 1) {
      const count = parseInt(String(installmentCount));
      const installmentAmount = Math.round((parsedAmount / count) * 100) / 100;
      const baseDate = dueDate ? new Date(dueDate) : new Date();

      for (let i = 0; i < count; i++) {
        const instDate = new Date(baseDate);
        instDate.setMonth(instDate.getMonth() + i);
        await prisma.deptPaymentInstallment.create({
          data: {
            paymentId: payment.id,
            amount: i === count - 1 ? parsedAmount - installmentAmount * (count - 1) : installmentAmount,
            dueDate: instDate,
          },
        });
      }
    }

    return NextResponse.json(payment, { status: 201 });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

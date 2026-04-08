import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        company: { select: { name: true } },
        project: { select: { id: true, name: true, projectCode: true, client: { select: { name: true } } } },
        items: true,
        payments: true,
        createdBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(invoices);
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const body = await request.json();
    if (!body.title || !body.dueDate || !body.companyId || !body.items?.length) {
      return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
    }

    // توليد رقم فاتورة
    const lastInvoice = await prisma.invoice.findFirst({ orderBy: { createdAt: "desc" }, select: { invoiceNumber: true } });
    let nextNum = 1;
    if (lastInvoice) {
      const match = lastInvoice.invoiceNumber.match(/INV-(\d+)/);
      if (match) nextNum = parseInt(match[1]) + 1;
    }
    const invoiceNumber = `INV-${String(nextNum).padStart(4, "0")}`;

    const items = body.items.map((item: { description: string; quantity: number; unitPrice: number }) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.quantity * item.unitPrice,
    }));

    const subtotal = items.reduce((s: number, i: { total: number }) => s + i.total, 0);
    const taxRate = 15;
    const taxAmount = subtotal * (taxRate / 100);
    const totalAmount = subtotal + taxAmount;

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        title: body.title,
        description: body.description || null,
        subtotal,
        taxRate,
        taxAmount,
        totalAmount,
        dueDate: new Date(body.dueDate),
        companyId: body.companyId,
        projectId: body.projectId || null,
        createdById: session.user.id,
        items: { create: items },
      },
      include: { items: true, company: { select: { name: true } } },
    });

    return NextResponse.json(invoice, { status: 201 });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

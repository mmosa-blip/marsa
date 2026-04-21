import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["ADMIN", "MANAGER"]);
    const { id } = await params;
    const body = await request.json();
    if (!body.amount) return NextResponse.json({ error: "المبلغ مطلوب" }, { status: 400 });

    const payment = await prisma.payment.create({
      data: {
        amount: parseFloat(body.amount),
        method: body.method || "BANK_TRANSFER",
        referenceNumber: body.referenceNumber || null,
        notes: body.notes || null,
        paymentDate: body.paymentDate ? new Date(body.paymentDate) : new Date(),
        invoiceId: id,
      },
    });

    // تحقق إذا تم دفع الفاتورة بالكامل
    const invoice = await prisma.invoice.findUnique({ where: { id }, include: { payments: true } });
    if (invoice) {
      const totalPaid = invoice.payments.reduce((s, p) => s + p.amount, 0);
      if (totalPaid >= invoice.totalAmount) {
        await prisma.invoice.update({ where: { id }, data: { status: "PAID" } });
      } else if (invoice.status === "DRAFT") {
        await prisma.invoice.update({ where: { id }, data: { status: "SENT" } });
      }
    }

    return NextResponse.json(payment, { status: 201 });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

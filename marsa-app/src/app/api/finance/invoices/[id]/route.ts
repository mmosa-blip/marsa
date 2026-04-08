import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAuditLog, AuditModule } from "@/lib/audit";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    const { id } = await params;
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        company: { select: { name: true, commercialRegister: true } },
        project: { select: { id: true, name: true, projectCode: true, client: { select: { name: true, email: true } } } },
        items: true,
        payments: { orderBy: { paymentDate: "desc" } },
        createdBy: { select: { name: true } },
      },
    });
    if (!invoice) return NextResponse.json({ error: "الفاتورة غير موجودة" }, { status: 404 });
    return NextResponse.json(invoice);
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }
    const { id } = await params;
    const body = await request.json();
    if (body.dueDate) body.dueDate = new Date(body.dueDate);
    const invoice = await prisma.invoice.update({ where: { id }, data: body });
    return NextResponse.json(invoice);
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }
    const { id } = await params;
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      select: { id: true, invoiceNumber: true, status: true },
    });
    if (!invoice) return NextResponse.json({ error: "الفاتورة غير موجودة" }, { status: 404 });
    if (invoice.status === "PAID") {
      return NextResponse.json({ error: "لا يمكن حذف فاتورة مدفوعة" }, { status: 400 });
    }
    await prisma.invoiceItem.deleteMany({ where: { invoiceId: id } });
    await prisma.invoice.delete({ where: { id } });
    await createAuditLog({
      userId: session.user.id,
      action: "INVOICE_DELETED",
      module: AuditModule.FINANCE,
      notes: `حذف فاتورة رقم ${invoice.invoiceNumber}`,
      entityId: id,
      entityType: "Invoice",
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

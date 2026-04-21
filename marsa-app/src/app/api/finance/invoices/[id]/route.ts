import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAuditLog, AuditModule } from "@/lib/audit";
import { requireAuth, requireRole } from "@/lib/api-auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
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
    if (error instanceof Response) return error;
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["ADMIN", "MANAGER"]);
    const { id } = await params;
    const body = await request.json();
    if (body.dueDate) body.dueDate = new Date(body.dueDate);
    const invoice = await prisma.invoice.update({ where: { id }, data: body });
    return NextResponse.json(invoice);
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRole(["ADMIN", "MANAGER"]);
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
    if (error instanceof Response) return error;
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can, PERMISSIONS } from "@/lib/permissions";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }
    if (!(await can(session.user.id, session.user.role, PERMISSIONS.FINANCE_CASHIER))) {
      return NextResponse.json({ error: "ليس لديك صلاحية" }, { status: 403 });
    }

    const body = await request.json();
    const { clientId, services, paymentMethod, amountReceived, referenceNumber } = body;

    if (!clientId || !services?.length || !paymentMethod) {
      return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
    }

    // حساب المبالغ
    const totalAmount = services.reduce((s: number, svc: { price: number; quantity: number }) => s + svc.price * (svc.quantity || 1), 0);
    const taxRate = 15;
    const taxAmount = totalAmount * (taxRate / 100);
    const grandTotal = totalAmount + taxAmount;

    // حساب الباقي (للنقدي)
    const changeAmount = paymentMethod === "CASH" && amountReceived ? amountReceived - grandTotal : 0;

    // الحصول على شركة العميل
    const client = await prisma.user.findUnique({
      where: { id: clientId },
      include: { ownedCompanies: { select: { id: true }, take: 1 } },
    });

    if (!client) return NextResponse.json({ error: "العميل غير موجود" }, { status: 404 });

    // إنشاء شركة افتراضية إذا لم تكن موجودة
    let companyId = client.ownedCompanies[0]?.id;
    if (!companyId) {
      const newCompany = await prisma.company.create({
        data: { name: `شركة ${client.name}`, ownerId: clientId },
      });
      companyId = newCompany.id;
    }

    // توليد رقم الفاتورة
    const lastInvoice = await prisma.invoice.findFirst({ orderBy: { createdAt: "desc" }, select: { invoiceNumber: true } });
    let nextInvNum = 1;
    if (lastInvoice) {
      const match = lastInvoice.invoiceNumber.match(/INV-(\d+)/);
      if (match) nextInvNum = parseInt(match[1]) + 1;
    }
    const invoiceNumber = `INV-${String(nextInvNum).padStart(4, "0")}`;

    // توليد رقم العملية
    const lastTxn = await prisma.cashierTransaction.findFirst({ orderBy: { createdAt: "desc" }, select: { transactionNumber: true } });
    let nextTxnNum = 1;
    if (lastTxn) {
      const match = lastTxn.transactionNumber.match(/TXN-(\d+)/);
      if (match) nextTxnNum = parseInt(match[1]) + 1;
    }
    const transactionNumber = `TXN-${String(nextTxnNum).padStart(4, "0")}`;

    // تحديد حالة الفاتورة
    const invoiceStatus = paymentMethod === "DEFERRED" ? "SENT" : "PAID";

    // تحويل طريقة الدفع للفاتورة
    const paymentMethodMap: Record<string, string> = {
      CASH: "CASH", MADA: "CREDIT_CARD", BANK_TRANSFER: "BANK_TRANSFER", DEFERRED: "BANK_TRANSFER",
    };

    // إنشاء بنود الفاتورة
    const items = services.map((svc: { name: string; price: number; quantity: number }) => ({
      description: svc.name,
      quantity: svc.quantity || 1,
      unitPrice: svc.price,
      total: svc.price * (svc.quantity || 1),
    }));

    // إنشاء الفاتورة
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        title: services.length === 1 ? services[0].name : `عملية كاشير - ${transactionNumber}`,
        subtotal: totalAmount,
        taxRate,
        taxAmount,
        totalAmount: grandTotal,
        status: invoiceStatus,
        dueDate: new Date(),
        companyId,
        clientId,
        createdById: session.user.id,
        items: { create: items },
      },
    });

    // إنشاء الدفعة (إذا ليست آجلة)
    if (paymentMethod !== "DEFERRED") {
      await prisma.payment.create({
        data: {
          amount: grandTotal,
          method: paymentMethodMap[paymentMethod] as "CASH" | "CREDIT_CARD" | "BANK_TRANSFER" | "CHECK",
          referenceNumber: referenceNumber || null,
          invoiceId: invoice.id,
          notes: `عملية كاشير ${transactionNumber}`,
        },
      });
    }

    // ربط الخدمات بالعميل
    for (const svc of services) {
      if (svc.id) {
        // خدمة موجودة - نسخة جديدة مربوطة بالعميل
        await prisma.service.create({
          data: {
            name: svc.name,
            price: svc.price,
            category: svc.category || null,
            clientId,
            status: paymentMethod === "DEFERRED" ? "PENDING" : "IN_PROGRESS",
          },
        });
      }
    }

    // إنشاء سجل العملية
    const transaction = await prisma.cashierTransaction.create({
      data: {
        transactionNumber,
        totalAmount,
        taxAmount,
        grandTotal,
        paymentMethod,
        amountReceived: amountReceived || null,
        changeAmount: changeAmount > 0 ? changeAmount : null,
        referenceNumber: referenceNumber || null,
        status: paymentMethod === "DEFERRED" ? "DEFERRED" : "COMPLETED",
        clientId,
        invoiceId: invoice.id,
        cashierId: session.user.id,
      },
    });

    return NextResponse.json({
      ...transaction,
      invoiceNumber,
    }, { status: 201 });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "MANAGER", "EXECUTOR"].includes(session.user.role)) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const transactions = await prisma.cashierTransaction.findMany({
      include: {
        client: { select: { name: true } },
        cashier: { select: { name: true } },
        invoice: { select: { invoiceNumber: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json(transactions);
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

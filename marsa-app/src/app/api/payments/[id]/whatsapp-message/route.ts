import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { logger } from "@/lib/logger";

// GET /api/payments/[id]/whatsapp-message
//
// Builds a polite, ready-to-send WhatsApp message for a given
// installment and returns both the message body and a wa.me URL the
// admin can open in a new tab. Does NOT send anything.

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole([
      "ADMIN",
      "MANAGER",
      "FINANCE_MANAGER",
      "TREASURY_MANAGER",
    ]);
    const { id } = await params;

    const inst = await prisma.contractPaymentInstallment.findUnique({
      where: { id },
      select: {
        title: true,
        amount: true,
        paidAmount: true,
        waiverAmount: true,
        dueAfterDays: true,
        createdAt: true,
        contract: {
          select: {
            signedAt: true,
            client: { select: { name: true, phone: true } },
            project: { select: { name: true } },
          },
        },
      },
    });
    if (!inst) {
      return NextResponse.json({ error: "غير موجود" }, { status: 404 });
    }

    const clientName = inst.contract?.client?.name ?? "العميل الكريم";
    const projectName = inst.contract?.project?.name ?? "المشروع";
    const remaining = Math.max(
      0,
      inst.amount -
        inst.paidAmount -
        (inst.waiverAmount ? Number(inst.waiverAmount) : 0)
    );
    const signed = inst.contract?.signedAt ?? inst.createdAt;
    const dueDate = inst.dueAfterDays
      ? new Date(new Date(signed).getTime() + inst.dueAfterDays * 86400000)
      : null;
    const dueDateStr = dueDate
      ? dueDate.toLocaleDateString("ar-SA-u-nu-latn", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : "—";

    const message =
      `السلام عليكم ${clientName}،\n` +
      `\n` +
      `نأمل التكرم بمتابعة دفعة المشروع: ${projectName}\n` +
      `الدفعة: ${inst.title}\n` +
      `المبلغ المتبقي: ${remaining.toLocaleString("en-US")} ريال\n` +
      `تاريخ الاستحقاق: ${dueDateStr}\n` +
      `\n` +
      `شاكرين لكم تعاونكم.\n` +
      `— مرسى`;

    const phone = inst.contract?.client?.phone?.replace(/[^\d]/g, "") ?? null;
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
      : null;

    return NextResponse.json({ message, url, phone });
  } catch (e) {
    if (e instanceof Response) return e;
    logger.error("whatsapp-message GET", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

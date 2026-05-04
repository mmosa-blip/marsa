import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { logger } from "@/lib/logger";
import { createAuditLog, AuditModule } from "@/lib/audit";
import { pusherServer } from "@/lib/pusher";

// POST /api/payments/[id]/payment
// body: { amount: number, method: "CASH" | "TRANSFER" | "CHEQUE" | "OTHER",
//         paymentDate?: ISO string, note?: string, expectedRemainingDate?: ISO }
//
// Records a partial or full payment against a ContractPaymentInstallment.
// Appends to the partialPayments JSON for history; bumps paidAmount and
// flips paymentStatus to PAID once the running total covers everything
// (amount - waiver). Idempotent on duplicate-submit by virtue of always
// adding a new history row — the admin can see the duplicate and reverse.

const ALLOWED_METHODS = ["CASH", "TRANSFER", "CHEQUE", "BANK_TRANSFER", "OTHER"] as const;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRole([
      "ADMIN",
      "MANAGER",
      "FINANCE_MANAGER",
      "TREASURY_MANAGER",
    ]);
    const { id } = await params;
    const body = await request.json();

    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "المبلغ غير صالح" }, { status: 400 });
    }
    const method = (ALLOWED_METHODS as readonly string[]).includes(String(body.method))
      ? String(body.method)
      : "OTHER";
    const paymentDate = body.paymentDate ? new Date(body.paymentDate) : new Date();
    if (Number.isNaN(paymentDate.getTime())) {
      return NextResponse.json({ error: "تاريخ غير صالح" }, { status: 400 });
    }

    const inst = await prisma.contractPaymentInstallment.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        amount: true,
        paidAmount: true,
        waiverAmount: true,
        partialPayments: true,
        contract: { select: { id: true, projectId: true, clientId: true } },
      },
    });
    if (!inst) {
      return NextResponse.json({ error: "غير موجود" }, { status: 404 });
    }

    const waiver = inst.waiverAmount ? Number(inst.waiverAmount) : 0;
    const target = inst.amount - waiver;
    const newPaid = inst.paidAmount + amount;
    const isPaidNow = newPaid >= target - 0.001;

    const newEntry = {
      amount,
      date: paymentDate.toISOString(),
      method,
      receivedBy: session.user.id,
      receivedByName: session.user.name ?? null,
      note: body.note ? String(body.note) : null,
      expectedRemainingDate: body.expectedRemainingDate ? String(body.expectedRemainingDate) : null,
    };
    const history = Array.isArray(inst.partialPayments)
      ? (inst.partialPayments as unknown[])
      : [];
    const updatedHistory = [...history, newEntry];

    const updated = await prisma.contractPaymentInstallment.update({
      where: { id },
      data: {
        paidAmount: newPaid,
        paymentStatus: isPaidNow ? "PAID" : "PARTIAL",
        paidAt: isPaidNow ? paymentDate : null,
        partialPayments: updatedHistory as Prisma.InputJsonValue,
      },
    });

    await createAuditLog({
      userId: session.user.id,
      userName: session.user.name ?? undefined,
      userRole: session.user.role,
      action: "PAYMENT_RECORDED",
      module: AuditModule.FINANCE,
      severity: "INFO",
      entityType: "ContractPaymentInstallment",
      entityId: inst.id,
      entityName: inst.title,
      before: { paidAmount: inst.paidAmount, paymentStatus: "UNPAID" },
      after: {
        paidAmount: newPaid,
        paymentStatus: isPaidNow ? "PAID" : "PARTIAL",
        method,
        amount,
      },
    });

    if (isPaidNow) {
      try {
        await pusherServer.trigger("payments", "payment-paid", {
          installmentId: inst.id,
          projectId: inst.contract?.projectId,
          clientId: inst.contract?.clientId,
        });
      } catch (err) {
        logger.warn("payments pusher failed", { err: String(err) });
      }
    }

    return NextResponse.json({
      ok: true,
      paid: isPaidNow,
      paidAmount: updated.paidAmount,
    });
  } catch (e) {
    if (e instanceof Response) return e;
    logger.error("payment POST", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

// Re-imported for the as-cast on JSON storage.
import type { Prisma } from "@/generated/prisma/client";

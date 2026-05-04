import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { logger } from "@/lib/logger";
import { createAuditLog, AuditModule } from "@/lib/audit";

// POST /api/payments/[id]/waiver
// body: { amount: number, reason: string }
//
// Admin-only: writes off part (or all) of an installment without
// marking it paid. The remaining-due math becomes:
//   remaining = amount - paidAmount - waiverAmount
//
// One-shot — replaces any prior waiver. Audit trail captures who, why,
// before/after.

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRole(["ADMIN"]);
    const { id } = await params;
    const body = await request.json();

    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "المبلغ غير صالح" }, { status: 400 });
    }
    const reason = String(body.reason ?? "").trim();
    if (!reason) {
      return NextResponse.json({ error: "السبب مطلوب" }, { status: 400 });
    }

    const inst = await prisma.contractPaymentInstallment.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        amount: true,
        paidAmount: true,
        waiverAmount: true,
      },
    });
    if (!inst) {
      return NextResponse.json({ error: "غير موجود" }, { status: 404 });
    }

    const maxWaivable = inst.amount - inst.paidAmount;
    if (amount > maxWaivable + 0.001) {
      return NextResponse.json(
        { error: `لا يمكن أن يتجاوز التنازل المبلغ المتبقي (${maxWaivable})` },
        { status: 400 }
      );
    }

    // Flip to PAID when the waiver covers the rest exactly. If there's
    // anything left, status stays whatever it was (UNPAID or PARTIAL)
    // and the remaining shrinks via the math above.
    const isFullyCovered = amount >= maxWaivable - 0.001;

    const updated = await prisma.contractPaymentInstallment.update({
      where: { id },
      data: {
        waiverAmount: amount,
        waiverReason: reason,
        waiverBy: session.user.id,
        waiverAt: new Date(),
        ...(isFullyCovered
          ? { paymentStatus: "PAID", paidAt: new Date() }
          : {}),
      },
    });

    await createAuditLog({
      userId: session.user.id,
      userName: session.user.name ?? undefined,
      userRole: session.user.role,
      action: "PAYMENT_WAIVED",
      module: AuditModule.FINANCE,
      severity: "WARN",
      entityType: "ContractPaymentInstallment",
      entityId: inst.id,
      entityName: inst.title,
      before: {
        amount: inst.amount,
        paidAmount: inst.paidAmount,
        waiverAmount: inst.waiverAmount ? Number(inst.waiverAmount) : 0,
      },
      after: {
        waiverAmount: amount,
        reason,
        nowPaid: isFullyCovered,
      },
    });

    return NextResponse.json({
      ok: true,
      waiverAmount: updated.waiverAmount,
      paymentStatus: updated.paymentStatus,
    });
  } catch (e) {
    if (e instanceof Response) return e;
    logger.error("waiver POST", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

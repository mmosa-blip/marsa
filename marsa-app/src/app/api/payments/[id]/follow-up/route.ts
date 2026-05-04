import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { logger } from "@/lib/logger";
import { createAuditLog, AuditModule } from "@/lib/audit";

// POST /api/payments/[id]/follow-up
// body: { outcome, notes, promisedDate?, promisedAmount?, nextFollowUpAt? }

const ALLOWED_OUTCOMES = [
  "PROMISED_PAYMENT",
  "UNREACHABLE",
  "REFUSED",
  "RESCHEDULED",
  "OTHER",
] as const;

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

    const outcome = String(body.outcome ?? "");
    if (!(ALLOWED_OUTCOMES as readonly string[]).includes(outcome)) {
      return NextResponse.json({ error: "نتيجة غير صالحة" }, { status: 400 });
    }
    const notes = String(body.notes ?? "").trim();
    if (!notes) {
      return NextResponse.json({ error: "الملاحظات مطلوبة" }, { status: 400 });
    }

    const inst = await prisma.contractPaymentInstallment.findUnique({
      where: { id },
      select: { id: true, title: true },
    });
    if (!inst) {
      return NextResponse.json({ error: "غير موجود" }, { status: 404 });
    }

    const promisedDate = body.promisedDate ? new Date(body.promisedDate) : null;
    const promisedAmount =
      body.promisedAmount != null && Number.isFinite(Number(body.promisedAmount))
        ? Number(body.promisedAmount)
        : null;
    const nextFollowUpAt = body.nextFollowUpAt
      ? new Date(body.nextFollowUpAt)
      : null;

    // Map outcome → followUpStatus shorthand stored on the installment
    // for fast filtering. Full history lives on PaymentFollowUp rows.
    const followUpStatus =
      outcome === "PROMISED_PAYMENT" ? "PROMISED" :
      outcome === "UNREACHABLE"      ? "UNREACHABLE" :
      outcome === "REFUSED"          ? "EVADING" :
      outcome === "RESCHEDULED"      ? "RESPONSIVE" :
      "RESPONSIVE";

    const created = await prisma.paymentFollowUp.create({
      data: {
        installmentId: id,
        contactedBy: session.user.id,
        outcome,
        notes,
        promisedDate,
        promisedAmount,
        nextFollowUpAt,
      },
    });

    await prisma.contractPaymentInstallment.update({
      where: { id },
      data: {
        lastContactDate: new Date(),
        lastContactBy: session.user.id,
        lastContactSummary: notes.slice(0, 500),
        nextContactDate: nextFollowUpAt,
        followUpStatus,
      },
    });

    await createAuditLog({
      userId: session.user.id,
      userName: session.user.name ?? undefined,
      userRole: session.user.role,
      action: "PAYMENT_FOLLOWUP_LOGGED",
      module: AuditModule.FINANCE,
      severity: "INFO",
      entityType: "ContractPaymentInstallment",
      entityId: inst.id,
      entityName: inst.title,
      after: { outcome, hasPromise: !!promisedDate, nextFollowUpAt },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    if (e instanceof Response) return e;
    logger.error("follow-up POST", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

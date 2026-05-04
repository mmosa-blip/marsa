import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { logger } from "@/lib/logger";
import { createAuditLog, AuditModule } from "@/lib/audit";

// POST /api/contracts/[id]/setup-installments
// body: { installments: [{ title?, percentage?, amount?, dueAfterDays? }] }
//
// Bulk-defines the payment schedule on a contract that has none. The
// wizard's API target — refuses to overwrite existing installments
// (the contract editor handles edits separately).

interface InstallmentInput {
  title?: string;
  percentage?: number;
  amount?: number;
  dueAfterDays?: number;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRole(["ADMIN", "MANAGER", "FINANCE_MANAGER"]);
    const { id } = await params;
    const body = await request.json();

    const inputs: InstallmentInput[] = Array.isArray(body.installments)
      ? body.installments
      : [];
    if (inputs.length === 0) {
      return NextResponse.json({ error: "أضف دفعة واحدة على الأقل" }, { status: 400 });
    }

    const contract = await prisma.contract.findUnique({
      where: { id },
      select: {
        id: true,
        contractNumber: true,
        contractValue: true,
        status: true,
        client: { select: { name: true } },
        _count: { select: { installments: true } },
      },
    });
    if (!contract) {
      return NextResponse.json({ error: "العقد غير موجود" }, { status: 404 });
    }
    if (contract._count.installments > 0) {
      return NextResponse.json(
        { error: "العقد له جدول دفعات معرّف بالفعل" },
        { status: 409 }
      );
    }

    const total = contract.contractValue ?? 0;

    // Resolve each row's amount: explicit `amount` wins; otherwise
    // compute from `percentage` against contractValue. Validation:
    //   - amount must be > 0
    //   - dueAfterDays >= 0 (0 = due on signing)
    //   - title ≤ 200 chars (nice-to-have)
    const data = inputs.map((inst, idx) => {
      const pct =
        typeof inst.percentage === "number" && Number.isFinite(inst.percentage)
          ? inst.percentage
          : null;
      const explicit =
        typeof inst.amount === "number" && Number.isFinite(inst.amount)
          ? inst.amount
          : null;
      const amount =
        explicit ?? (pct != null && total > 0 ? (total * pct) / 100 : 0);
      if (amount <= 0) {
        throw new Error(`الدفعة #${idx + 1}: المبلغ غير صالح`);
      }
      const dueAfterDays =
        typeof inst.dueAfterDays === "number" && Number.isFinite(inst.dueAfterDays)
          ? Math.max(0, Math.trunc(inst.dueAfterDays))
          : null;
      const title = (inst.title ?? `الدفعة ${idx + 1}`).toString().trim().slice(0, 200);

      return {
        contractId: id,
        title,
        amount,
        percentage: pct,
        dueAfterDays,
        order: idx,
        isLocked: idx > 0,
      };
    });

    await prisma.contractPaymentInstallment.createMany({ data });

    await createAuditLog({
      userId: session.user.id,
      userName: session.user.name ?? undefined,
      userRole: session.user.role,
      action: "INSTALLMENTS_DEFINED",
      module: AuditModule.FINANCE,
      severity: "INFO",
      entityType: "Contract",
      entityId: contract.id,
      entityName: `Contract #${contract.contractNumber ?? "—"} — ${contract.client?.name ?? ""}`,
      after: {
        count: data.length,
        total: data.reduce((s, x) => s + x.amount, 0),
      },
    });

    return NextResponse.json({ ok: true, count: data.length });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof Error && e.message.startsWith("الدفعة")) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    logger.error("setup-installments POST", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

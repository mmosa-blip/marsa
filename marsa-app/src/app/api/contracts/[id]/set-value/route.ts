import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { logger } from "@/lib/logger";
import { createAuditLog, AuditModule } from "@/lib/audit";

// PATCH /api/contracts/[id]/set-value
// body: { contractValue: number }
//
// Manual entry point used by the payments setup wizard when a
// contract has no value recorded anywhere (neither contract.contractValue
// nor project.totalPrice). Audited as CONTRACT_VALUE_UPDATED.

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRole(["ADMIN", "MANAGER", "FINANCE_MANAGER"]);
    const { id } = await params;
    const body = await request.json();

    const raw = body.contractValue;
    const value =
      typeof raw === "number" && Number.isFinite(raw)
        ? raw
        : Number(raw);
    if (!Number.isFinite(value) || value <= 0) {
      return NextResponse.json(
        { error: "قيمة العقد يجب أن تكون رقماً موجباً" },
        { status: 400 }
      );
    }

    const before = await prisma.contract.findUnique({
      where: { id },
      select: {
        contractNumber: true,
        contractValue: true,
        client: { select: { name: true } },
      },
    });
    if (!before) {
      return NextResponse.json({ error: "العقد غير موجود" }, { status: 404 });
    }

    const updated = await prisma.contract.update({
      where: { id },
      data: { contractValue: value },
      select: { id: true, contractValue: true },
    });

    createAuditLog({
      userId: session.user.id,
      userName: session.user.name ?? undefined,
      userRole: session.user.role,
      action: "CONTRACT_VALUE_UPDATED",
      module: AuditModule.CONTRACTS,
      severity: "INFO",
      entityType: "Contract",
      entityId: id,
      entityName: `Contract #${before.contractNumber ?? "—"} — ${before.client?.name ?? ""}`,
      before: { contractValue: before.contractValue },
      after: { contractValue: value },
    });

    return NextResponse.json(updated);
  } catch (e) {
    if (e instanceof Response) return e;
    logger.error("contracts set-value PATCH", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

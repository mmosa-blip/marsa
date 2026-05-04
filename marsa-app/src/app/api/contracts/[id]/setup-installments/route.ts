import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { logger } from "@/lib/logger";
import { createAuditLog, AuditModule } from "@/lib/audit";

// POST /api/contracts/[id]/setup-installments
// body: { installments: [{ title?, amount?, percentage?, linkedServiceId?, isUpfront? }] }
//
// Bulk-defines a milestone-based payment schedule on a contract that
// has none. The wizard's API target — refuses to overwrite existing
// installments. Each installment is either upfront (no link, unlocked)
// or anchored to a project service (linked to that service's first
// task, locked unless it is the first row).
//
// Legacy fields (dueAfterDays) are still accepted for back-compat
// with the older time-based wizard but no longer encouraged.

interface InstallmentInput {
  title?: string;
  amount?: number;
  percentage?: number;
  linkedServiceId?: string | null;
  isUpfront?: boolean;
  // legacy
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
        // Resolve project + services + first-task-per-service for the
        // linkedTaskId lookup. Either side of the relation works.
        project: {
          select: {
            id: true,
            services: {
              where: { deletedAt: null },
              select: {
                id: true,
                name: true,
                serviceOrder: true,
                tasks: {
                  select: { id: true },
                  orderBy: { order: "asc" },
                  take: 1,
                },
              },
              orderBy: { serviceOrder: "asc" },
            },
          },
        },
        linkedProjects: {
          select: {
            id: true,
            services: {
              where: { deletedAt: null },
              select: {
                id: true,
                name: true,
                serviceOrder: true,
                tasks: {
                  select: { id: true },
                  orderBy: { order: "asc" },
                  take: 1,
                },
              },
              orderBy: { serviceOrder: "asc" },
            },
          },
          take: 1,
        },
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

    // Build a serviceId → firstTaskId lookup from whichever side of
    // the project relation is populated.
    const services =
      contract.project?.services ??
      contract.linkedProjects[0]?.services ??
      [];
    const serviceIndex = new Map<string, { id: string; firstTaskId: string | null }>();
    for (const s of services) {
      serviceIndex.set(s.id, { id: s.id, firstTaskId: s.tasks[0]?.id ?? null });
    }

    const total = contract.contractValue ?? 0;

    // Resolve each row. Validation:
    //   - amount must be > 0 (computed from percentage if missing)
    //   - title ≤ 200 chars
    //   - if linkedServiceId is provided, it must exist on this
    //     project, and its first task must exist
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

      const isUpfront = inst.isUpfront === true || !inst.linkedServiceId;
      let linkedTaskId: string | null = null;

      if (!isUpfront && inst.linkedServiceId) {
        const svc = serviceIndex.get(inst.linkedServiceId);
        if (!svc) {
          throw new Error(
            `الدفعة #${idx + 1}: الخدمة المختارة لا تنتمي لهذا المشروع`
          );
        }
        if (!svc.firstTaskId) {
          throw new Error(
            `الدفعة #${idx + 1}: الخدمة المختارة لا تحتوي على مهام`
          );
        }
        linkedTaskId = svc.firstTaskId;
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
        // Upfront → unlocked. Otherwise: first row unlocked, rest locked.
        isLocked: isUpfront ? false : idx > 0,
        linkedTaskId,
      };
    });

    // createMany doesn't allow nullable relation fields cleanly; use
    // a per-row create instead so linkedTaskId stays null when blank.
    for (const row of data) {
      const { linkedTaskId, ...rest } = row;
      await prisma.contractPaymentInstallment.create({
        data: { ...rest, ...(linkedTaskId ? { linkedTaskId } : {}) },
      });
    }

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
        upfrontCount: data.filter((x) => !x.linkedTaskId).length,
        linkedCount: data.filter((x) => x.linkedTaskId).length,
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

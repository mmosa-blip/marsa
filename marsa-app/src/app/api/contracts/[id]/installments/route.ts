import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { logger } from "@/lib/logger";
import { createAuditLog, AuditModule } from "@/lib/audit";

// ─── GET /api/contracts/[id]/installments ──────────────────────────────
//
// Returns everything the editor needs in a single round-trip:
//   - the contract (id, value, project name, services in order)
//   - the existing installments with their payment state
//
// linkedServiceIndex is reverse-resolved so the UI can show which
// service each installment is linked to without having to walk the
// task → service relation client-side.

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

    const contract = await prisma.contract.findUnique({
      where: { id },
      select: {
        id: true,
        contractNumber: true,
        contractValue: true,
        client: { select: { id: true, name: true } },
        project: {
          select: {
            id: true,
            name: true,
            totalPrice: true,
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
            name: true,
            totalPrice: true,
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
        installments: {
          orderBy: { order: "asc" },
          select: {
            id: true,
            title: true,
            amount: true,
            percentage: true,
            order: true,
            isLocked: true,
            linkedTaskId: true,
            paymentStatus: true,
            paidAmount: true,
            partialPayments: true,
          },
        },
      },
    });
    if (!contract) {
      return NextResponse.json({ error: "العقد غير موجود" }, { status: 404 });
    }

    const project = contract.project ?? contract.linkedProjects[0] ?? null;
    const services = project?.services ?? [];

    // Reverse-map linkedTaskId → serviceIndex (the index in the
    // ordered services list whose first task matches). The editor
    // edits service indices; this lets it round-trip cleanly.
    const taskToServiceIndex = new Map<string, number>();
    services.forEach((s, idx) => {
      const t = s.tasks[0];
      if (t) taskToServiceIndex.set(t.id, idx);
    });

    // Effective contract value with project.totalPrice fallback —
    // matches the resolution used elsewhere in the payments stack.
    const effectiveValue =
      (contract.contractValue && contract.contractValue > 0
        ? contract.contractValue
        : null) ??
      (project?.totalPrice && project.totalPrice > 0
        ? project.totalPrice
        : null);

    return NextResponse.json({
      contract: {
        id: contract.id,
        contractNumber: contract.contractNumber,
        contractValue: contract.contractValue,
        effectiveValue,
        client: contract.client,
        projectId: project?.id ?? null,
        projectName: project?.name ?? null,
        services: services.map((s) => ({
          id: s.id,
          name: s.name,
          order: s.serviceOrder,
          hasTasks: s.tasks.length > 0,
        })),
      },
      installments: contract.installments.map((i) => ({
        id: i.id,
        title: i.title,
        amount: i.amount,
        percentage: i.percentage,
        order: i.order,
        isLocked: i.isLocked,
        isUpfront: i.linkedTaskId == null,
        linkedTaskId: i.linkedTaskId,
        linkedServiceIndex:
          i.linkedTaskId != null
            ? taskToServiceIndex.get(i.linkedTaskId) ?? null
            : null,
        paymentStatus: i.paymentStatus,
        paidAmount: i.paidAmount,
        partialPayments: i.partialPayments,
      })),
    });
  } catch (e) {
    if (e instanceof Response) return e;
    logger.error("contracts installments GET", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

// ─── PATCH /api/contracts/[id]/installments ────────────────────────────
//
// Bulk-edits the schedule. The body is a complete replacement set:
//   - rows with `id` are updated
//   - rows without `id` are created
//   - existing rows whose id is missing from the body are deleted IF
//     they have zero paidAmount (otherwise the request is rejected)
//
// Validation: same rules as project creation (sum=value, upfront
// present, indices in range, no duplicates) plus the "can't reduce
// amount under paidAmount" rule per row.

interface InstallmentInput {
  id?: string;
  title: string;
  amount: number;
  isUpfront?: boolean;
  linkedServiceIndex?: number;
  paymentStatus?: string;
}

interface PatchBody {
  contractValue: number;
  installments: InstallmentInput[];
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRole([
      "ADMIN",
      "MANAGER",
      "FINANCE_MANAGER",
    ]);
    const { id } = await params;
    const body = (await request.json()) as PatchBody;

    const contractValue = Number(body.contractValue);
    if (!Number.isFinite(contractValue) || contractValue <= 0) {
      return NextResponse.json(
        { error: "قيمة العقد يجب أن تكون أكبر من صفر" },
        { status: 400 }
      );
    }
    const incoming = Array.isArray(body.installments) ? body.installments : [];
    if (incoming.length === 0) {
      return NextResponse.json(
        { error: "يجب وجود قسط واحد على الأقل" },
        { status: 400 }
      );
    }

    // Load contract + services + existing installments inside a
    // transaction so the rest of the validation reads a consistent
    // snapshot.
    const result = await prisma.$transaction(async (tx) => {
      const contract = await tx.contract.findUnique({
        where: { id },
        select: {
          id: true,
          contractNumber: true,
          contractValue: true,
          client: { select: { name: true } },
          project: {
            select: {
              services: {
                where: { deletedAt: null },
                select: {
                  id: true,
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
              services: {
                where: { deletedAt: null },
                select: {
                  id: true,
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
          installments: true,
        },
      });
      if (!contract) {
        throw new ApiError(404, "العقد غير موجود");
      }
      const services =
        contract.project?.services ??
        contract.linkedProjects[0]?.services ??
        [];

      // ─── Validation ───
      const sum = incoming.reduce((s, x) => s + (Number(x.amount) || 0), 0);
      if (Math.abs(sum - contractValue) > 0.01) {
        throw new ApiError(
          400,
          `مجموع الأقساط (${sum}) لا يطابق قيمة العقد (${contractValue})`
        );
      }
      const seen = new Set<number>();
      let hasUpfront = false;
      for (let i = 0; i < incoming.length; i++) {
        const row = incoming[i];
        const amount = Number(row.amount);
        if (!Number.isFinite(amount) || amount <= 0) {
          throw new ApiError(400, `الدفعة #${i + 1}: المبلغ غير صالح`);
        }
        if (row.isUpfront) {
          hasUpfront = true;
          continue;
        }
        if (
          typeof row.linkedServiceIndex !== "number" ||
          row.linkedServiceIndex < 0 ||
          row.linkedServiceIndex >= services.length
        ) {
          throw new ApiError(
            400,
            `الدفعة #${i + 1}: الخدمة المرتبطة خارج النطاق`
          );
        }
        if (seen.has(row.linkedServiceIndex)) {
          throw new ApiError(
            400,
            `الدفعة #${i + 1}: الخدمة المرتبطة مكررة`
          );
        }
        seen.add(row.linkedServiceIndex);
      }
      if (!hasUpfront) {
        throw new ApiError(
          400,
          "يجب وجود دفعة مقدمة (upfront) واحدة على الأقل"
        );
      }

      // Per-row guard: don't let amount fall below paidAmount.
      const existingMap = new Map(contract.installments.map((i) => [i.id, i]));
      for (let i = 0; i < incoming.length; i++) {
        const row = incoming[i];
        if (!row.id) continue;
        const existing = existingMap.get(row.id);
        if (!existing) continue; // unknown id — treated as new below
        if (Number(row.amount) < existing.paidAmount) {
          throw new ApiError(
            400,
            `الدفعة #${i + 1}: المبلغ (${row.amount}) أقل من المدفوع (${existing.paidAmount})`
          );
        }
      }

      // ─── Delete-set ───
      const incomingIds = new Set(
        incoming.filter((i) => i.id).map((i) => i.id as string)
      );
      const toDelete = contract.installments.filter(
        (i) => !incomingIds.has(i.id)
      );
      const protectedFromDeletion = toDelete.filter((i) => i.paidAmount > 0);
      if (protectedFromDeletion.length > 0) {
        throw new ApiError(
          400,
          `لا يمكن حذف ${protectedFromDeletion.length} قسط مدفوع: ${protectedFromDeletion.map((i) => i.title).join(", ")}`
        );
      }

      // ─── Apply ───
      const added: { id: string; title: string; amount: number }[] = [];
      const updated: {
        id: string;
        changes: Record<string, { from: unknown; to: unknown }>;
      }[] = [];
      const deleted: { id: string; title: string; amount: number }[] = [];

      // Delete unwanted rows first to free unique constraints (e.g. linkedTaskId).
      for (const row of toDelete) {
        await tx.contractPaymentInstallment.delete({ where: { id: row.id } });
        deleted.push({ id: row.id, title: row.title, amount: row.amount });
      }

      for (let i = 0; i < incoming.length; i++) {
        const row = incoming[i];
        const isUpfront = row.isUpfront === true;
        let linkedTaskId: string | null = null;
        if (!isUpfront && typeof row.linkedServiceIndex === "number") {
          linkedTaskId = services[row.linkedServiceIndex]?.tasks[0]?.id ?? null;
        }
        const percentage =
          contractValue > 0 ? (Number(row.amount) / contractValue) * 100 : null;
        const data = {
          title: row.title.trim().slice(0, 200),
          amount: Number(row.amount),
          percentage,
          order: i,
          isLocked: !isUpfront,
          linkedTaskId,
          ...(row.paymentStatus
            ? { paymentStatus: row.paymentStatus }
            : {}),
        };

        if (row.id && existingMap.has(row.id)) {
          const existing = existingMap.get(row.id)!;
          const changes: Record<string, { from: unknown; to: unknown }> = {};
          if (existing.title !== data.title)
            changes.title = { from: existing.title, to: data.title };
          if (existing.amount !== data.amount)
            changes.amount = { from: existing.amount, to: data.amount };
          if (existing.linkedTaskId !== data.linkedTaskId)
            changes.linkedTaskId = {
              from: existing.linkedTaskId,
              to: data.linkedTaskId,
            };
          if (existing.order !== data.order)
            changes.order = { from: existing.order, to: data.order };
          if (existing.isLocked !== data.isLocked)
            changes.isLocked = { from: existing.isLocked, to: data.isLocked };
          if (
            row.paymentStatus &&
            existing.paymentStatus !== row.paymentStatus
          ) {
            changes.paymentStatus = {
              from: existing.paymentStatus,
              to: row.paymentStatus,
            };
          }
          await tx.contractPaymentInstallment.update({
            where: { id: row.id },
            data,
          });
          if (Object.keys(changes).length > 0) {
            updated.push({ id: row.id, changes });
          }
        } else {
          const created = await tx.contractPaymentInstallment.create({
            data: { contractId: id, ...data },
          });
          added.push({
            id: created.id,
            title: created.title,
            amount: created.amount,
          });
        }
      }

      // Update Contract.contractValue if it changed.
      if (contract.contractValue !== contractValue) {
        await tx.contract.update({
          where: { id },
          data: { contractValue },
        });
      }

      return {
        contract,
        diff: { added, updated, deleted },
        partiallyPaidWarnings: contract.installments
          .filter((i) => {
            const incomingRow = incoming.find((x) => x.id === i.id);
            if (!incomingRow) return false;
            const partials = i.partialPayments;
            if (Array.isArray(partials) && partials.length > 0) return true;
            return i.paidAmount > 0 && i.paidAmount < i.amount;
          })
          .map((i) => i.title),
      };
    });

    await createAuditLog({
      userId: session.user.id,
      userName: session.user.name ?? undefined,
      userRole: session.user.role,
      action: "INSTALLMENTS_BULK_EDITED",
      module: AuditModule.FINANCE,
      severity:
        result.diff.deleted.length > 0 ||
        result.partiallyPaidWarnings.length > 0
          ? "WARN"
          : "INFO",
      entityType: "Contract",
      entityId: id,
      entityName: `Contract #${result.contract.contractNumber ?? "—"} — ${result.contract.client?.name ?? ""}`,
      before: { contractValue: result.contract.contractValue },
      after: { contractValue },
      meta: {
        added: result.diff.added,
        updated: result.diff.updated,
        deleted: result.diff.deleted,
        partiallyPaidEdited: result.partiallyPaidWarnings,
      },
    });

    return NextResponse.json({
      ok: true,
      diff: result.diff,
      partiallyPaidWarnings: result.partiallyPaidWarnings,
    });
  } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof ApiError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    logger.error("contracts installments PATCH", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

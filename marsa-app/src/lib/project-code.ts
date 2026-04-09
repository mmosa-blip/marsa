/**
 * Project code generator.
 *
 * Format (variable length — no padding, no separators):
 *   YY + clientNo + deptNo + contractNo + seq
 *
 * Example: 26 + 1 + 2 + 3 + 1  →  "261231"
 *
 * Year semantics — YY is the **last two digits of the contract year**
 * (not the system creation year). Resolution priority:
 *   1. explicit `year` argument (used by tests / future backfills)
 *   2. linked Contract.startDate year
 *   3. current year (project has no contract, or contract has no startDate)
 *
 * Each numeric segment prints its raw value with no leading zeros.
 * Missing segments fall back to "0" so the code is still well-formed.
 *
 * Concurrency note: the seq is computed via `findFirst({ orderBy: desc })
 * + 1` rather than an atomic counter, because the runtime connects to
 * Supabase through pgbouncer (transaction mode) which doesn't support
 * Prisma's interactive transactions. The DB-level @unique constraint on
 * Project.projectSeq is the safety net — if two creates race, the second
 * one fails and the caller can retry.
 */

import type { PrismaClient } from "@/generated/prisma/client";

export interface GenerateProjectCodeArgs {
  clientId: string;
  departmentId?: string | null;
  contractId?: string | null;
  // Optional override — used by the project-detail edit modal so that the
  // regenerated code reflects the *new* contract number that's about to be
  // written, not the stale value still in the DB.
  contractNumberOverride?: number | null;
  // Optional override for seq — used during regeneration so the project
  // keeps its existing tail instead of getting a brand-new sequence.
  seqOverride?: number | null;
  // Optional override for the year. When omitted, the generator derives
  // the year from the linked contract's startDate, falling back to the
  // current year.
  year?: number;
}

export interface GenerateProjectCodeResult {
  code: string;
  seq: number;
}

export async function generateProjectCode(
  prisma: PrismaClient,
  args: GenerateProjectCodeArgs
): Promise<GenerateProjectCodeResult> {
  // ── Client number ──
  const client = await prisma.user.findUnique({
    where: { id: args.clientId },
    select: { clientNumber: true },
  });
  const clientNo = String(client?.clientNumber ?? 0);

  // ── Department number ──
  let deptNo = "0";
  if (args.departmentId) {
    const dept = await prisma.department.findUnique({
      where: { id: args.departmentId },
      select: { deptNumber: true },
    });
    deptNo = String(dept?.deptNumber ?? 0);
  }

  // ── Contract data (single fetch for both number AND startDate) ──
  // Override (if passed) takes precedence on the number — used by the
  // edit-contract-number flow where the new value isn't persisted yet.
  let contractNo =
    args.contractNumberOverride != null
      ? String(args.contractNumberOverride)
      : "0";
  let yearFromContract: number | null = null;
  if (args.contractId) {
    const contract = await prisma.contract.findUnique({
      where: { id: args.contractId },
      select: { contractNumber: true, startDate: true },
    });
    if (args.contractNumberOverride == null) {
      contractNo = String(contract?.contractNumber ?? 0);
    }
    if (contract?.startDate) {
      yearFromContract = new Date(contract.startDate).getFullYear();
    }
  }

  // ── Year — last two digits only ──
  // explicit override > contract.startDate year > now
  const year = args.year ?? yearFromContract ?? new Date().getFullYear();
  const yearStr = String(year % 100).padStart(2, "0");

  // ── Sequence ──
  let seq: number;
  if (args.seqOverride != null) {
    seq = args.seqOverride;
  } else {
    const last = await prisma.project.findFirst({
      where: { projectSeq: { not: null } },
      orderBy: { projectSeq: "desc" },
      select: { projectSeq: true },
    });
    seq = (last?.projectSeq ?? 0) + 1;
  }
  const seqNo = String(seq);

  const code = `${yearStr}${clientNo}${deptNo}${contractNo}${seqNo}`;
  return { code, seq };
}

/**
 * Project code generator.
 *
 * Format (16 chars total):
 *   YYYY (4) + clientNo (3) + deptNo (2) + contractNo (3) + seq (4)
 *
 * Example: 2026 003 02 017 0042  →  2026003020170042
 *
 * Each segment falls back to zeros when its source field is missing
 * (no client, no department, no linked contract, etc.) so the code is
 * always well-formed and the same width — easier to align in UI.
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
  // Optional override for the year — defaults to "now". Lets a future
  // backfill or test pin a deterministic year.
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
  const year = args.year ?? new Date().getFullYear();
  const yearStr = String(year);

  // ── Client number (3 digits) ──
  const client = await prisma.user.findUnique({
    where: { id: args.clientId },
    select: { clientNumber: true },
  });
  const clientNo = String(client?.clientNumber ?? 0).padStart(3, "0");

  // ── Department number (2 digits) ──
  let deptNo = "00";
  if (args.departmentId) {
    const dept = await prisma.department.findUnique({
      where: { id: args.departmentId },
      select: { deptNumber: true },
    });
    deptNo = String(dept?.deptNumber ?? 0).padStart(2, "0");
  }

  // ── Contract number (3 digits) ──
  // Override (if passed) takes precedence — used by the edit-contract-number
  // flow where the new value isn't persisted yet.
  let contractNo = "000";
  if (args.contractNumberOverride != null) {
    contractNo = String(args.contractNumberOverride).padStart(3, "0");
  } else if (args.contractId) {
    const contract = await prisma.contract.findUnique({
      where: { id: args.contractId },
      select: { contractNumber: true },
    });
    contractNo = String(contract?.contractNumber ?? 0).padStart(3, "0");
  }

  // ── Sequence (4 digits) ──
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
  const seqNo = String(seq).padStart(4, "0");

  const code = `${yearStr}${clientNo}${deptNo}${contractNo}${seqNo}`;
  return { code, seq };
}

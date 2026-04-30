/* eslint-disable @typescript-eslint/no-explicit-any */
import "dotenv/config";

// ═══════════════════════════════════════════════════════════════════════
// Verify migration — Phase D
// ═══════════════════════════════════════════════════════════════════════
// Compares legacy and record-system tables to confirm the silent
// migration produced consistent rows. Per legacy table:
//   - count of legacy rows (eligible only — must have a project)
//   - count of matching ProjectRecordItem rows (matched via the
//     [TAG:legacyId] suffix the migration script writes)
//   - up to 10 sampled rows checked field-by-field, with any mismatches
//     printed inline
//
// Pure read-only — no writes. Safe to re-run any time.
//
//   npx tsx scripts/verify-record-migration.ts            # human report
//   npx tsx scripts/verify-record-migration.ts --json     # JSON report

const args = new Set(process.argv.slice(2));
const JSON_OUT = args.has("--json");

interface SectionReport {
  legacy: number;
  eligible: number;
  migrated: number;
  missing: number;
  sampled: number;
  diffs: { id: string; field: string; legacy: any; migrated: any }[];
}

const report = {
  startedAt: new Date().toISOString(),
  documents: section(),
  projectDocuments: section(),
  clientDocuments: section(),
  taskRequirementValues: section(),
  finishedAt: null as string | null,
};

function section(): SectionReport {
  return {
    legacy: 0,
    eligible: 0,
    migrated: 0,
    missing: 0,
    sampled: 0,
    diffs: [],
  };
}

function tag(prefix: string, id: string) {
  return `[${prefix}:${id}]`;
}

function pickSample<T>(arr: T[], n: number): T[] {
  if (arr.length <= n) return arr;
  // Evenly-spaced indices give a better signal than .slice(0, n) when
  // legacy data is roughly chronological — we cover both old and new.
  const step = arr.length / n;
  return Array.from({ length: n }, (_, i) => arr[Math.floor(i * step)]);
}

// ─────────────────────────────────────────────────────────────────
// Document → ProjectRecordItem (COMPLIANCE)
// ─────────────────────────────────────────────────────────────────

async function verifyDocuments(prisma: any) {
  const sec = report.documents;
  const docs = await prisma.document.findMany({
    select: {
      id: true,
      title: true,
      fileUrl: true,
      ownerId: true,
      expiryDate: true,
      reminderDays: true,
      status: true,
      owner: { select: { role: true } },
    },
  });
  sec.legacy = docs.length;

  // "Eligible" mirrors the migration's filter exactly: must have a
  // file, owner must be CLIENT, and that client must have a project.
  const eligible = [];
  for (const d of docs) {
    if (!d.fileUrl) continue;
    if (d.owner?.role !== "CLIENT") continue;
    const proj = await prisma.project.findFirst({
      where: { clientId: d.ownerId, deletedAt: null },
      select: { id: true },
    });
    if (proj) eligible.push(d);
  }
  sec.eligible = eligible.length;

  for (const d of pickSample(eligible, 10)) {
    sec.sampled++;
    const t = tag("DOC", d.id);
    const ri = await prisma.projectRecordItem.findFirst({
      where: { title: { contains: t } },
      select: {
        id: true,
        fileUrl: true,
        expiryDate: true,
        reminderDays: true,
        status: true,
      },
    });
    if (!ri) {
      sec.missing++;
      sec.diffs.push({ id: d.id, field: "(row)", legacy: "exists", migrated: "missing" });
      continue;
    }
    if (ri.fileUrl !== d.fileUrl)
      sec.diffs.push({ id: d.id, field: "fileUrl", legacy: d.fileUrl, migrated: ri.fileUrl });
    if (
      d.expiryDate &&
      ri.expiryDate &&
      new Date(d.expiryDate).getTime() !== new Date(ri.expiryDate).getTime()
    )
      sec.diffs.push({
        id: d.id,
        field: "expiryDate",
        legacy: d.expiryDate,
        migrated: ri.expiryDate,
      });
    if ((ri.reminderDays ?? null) !== (d.reminderDays ?? null))
      sec.diffs.push({
        id: d.id,
        field: "reminderDays",
        legacy: d.reminderDays,
        migrated: ri.reminderDays,
      });
  }

  sec.migrated = await prisma.projectRecordItem.count({
    where: { title: { contains: "[DOC:" } },
  });
}

// ─────────────────────────────────────────────────────────────────
// ProjectDocument → ProjectRecordItem (PROJECT)
// ─────────────────────────────────────────────────────────────────

async function verifyProjectDocuments(prisma: any) {
  const sec = report.projectDocuments;
  const docs = await prisma.projectDocument.findMany();
  sec.legacy = docs.length;
  const eligible = docs.filter((d: any) => d.fileUrl || d.textData);
  sec.eligible = eligible.length;

  for (const d of pickSample(eligible, 10)) {
    sec.sampled++;
    const t = tag("PD", d.id);
    const ri = await prisma.projectRecordItem.findFirst({
      where: { projectId: d.projectId, title: { contains: t } },
      select: {
        id: true,
        fileUrl: true,
        textData: true,
        documentTypeId: true,
        partnerId: true,
        status: true,
        rejectionReason: true,
        isSharedWithClient: true,
        uploadedById: true,
      },
    });
    if (!ri) {
      sec.missing++;
      sec.diffs.push({ id: d.id, field: "(row)", legacy: "exists", migrated: "missing" });
      continue;
    }
    if (ri.fileUrl !== d.fileUrl)
      sec.diffs.push({ id: d.id, field: "fileUrl", legacy: d.fileUrl, migrated: ri.fileUrl });
    if (ri.textData !== d.textData)
      sec.diffs.push({ id: d.id, field: "textData", legacy: d.textData, migrated: ri.textData });
    if (ri.documentTypeId !== d.documentTypeId)
      sec.diffs.push({
        id: d.id,
        field: "documentTypeId",
        legacy: d.documentTypeId,
        migrated: ri.documentTypeId,
      });
    if (ri.partnerId !== d.partnerId)
      sec.diffs.push({
        id: d.id,
        field: "partnerId",
        legacy: d.partnerId,
        migrated: ri.partnerId,
      });
    if (ri.uploadedById !== d.uploadedById)
      sec.diffs.push({
        id: d.id,
        field: "uploadedById",
        legacy: d.uploadedById,
        migrated: ri.uploadedById,
      });
    if (!!ri.isSharedWithClient !== !!d.isSharedWithClient)
      sec.diffs.push({
        id: d.id,
        field: "isSharedWithClient",
        legacy: d.isSharedWithClient,
        migrated: ri.isSharedWithClient,
      });
  }

  sec.migrated = await prisma.projectRecordItem.count({
    where: { title: { contains: "[PD:" } },
  });
}

// ─────────────────────────────────────────────────────────────────
// ClientDocument → ProjectRecordItem (CLIENT)
// ─────────────────────────────────────────────────────────────────

async function verifyClientDocuments(prisma: any) {
  const sec = report.clientDocuments;
  const docs = await prisma.clientDocument.findMany();
  sec.legacy = docs.length;

  const eligible = [];
  for (const d of docs) {
    const proj = await prisma.project.findFirst({
      where: { clientId: d.clientId, deletedAt: null },
      select: { id: true },
    });
    if (proj) eligible.push(d);
  }
  sec.eligible = eligible.length;

  for (const d of pickSample(eligible, 10)) {
    sec.sampled++;
    const t = tag("CD", d.id);
    const ri = await prisma.projectRecordItem.findFirst({
      where: { title: { contains: t } },
      select: { id: true, fileUrl: true, uploadedById: true },
    });
    if (!ri) {
      sec.missing++;
      sec.diffs.push({ id: d.id, field: "(row)", legacy: "exists", migrated: "missing" });
      continue;
    }
    if (ri.fileUrl !== d.fileUrl)
      sec.diffs.push({ id: d.id, field: "fileUrl", legacy: d.fileUrl, migrated: ri.fileUrl });
    if (ri.uploadedById !== d.uploadedById)
      sec.diffs.push({
        id: d.id,
        field: "uploadedById",
        legacy: d.uploadedById,
        migrated: ri.uploadedById,
      });
  }

  sec.migrated = await prisma.projectRecordItem.count({
    where: { title: { contains: "[CD:" } },
  });
}

// ─────────────────────────────────────────────────────────────────
// TaskRequirementValue → ProjectRecordItem + TaskRequirementLink
// ─────────────────────────────────────────────────────────────────

async function verifyTaskRequirementValues(prisma: any) {
  const sec = report.taskRequirementValues;
  const values = await prisma.taskRequirementValue.findMany({
    where: { fileUrl: { not: null } },
    include: { task: { select: { projectId: true } } },
  });
  sec.legacy = values.length;
  const eligible = values.filter((v: any) => v.fileUrl && v.task?.projectId);
  sec.eligible = eligible.length;

  for (const v of pickSample(eligible, 10)) {
    sec.sampled++;
    const t = tag("TRV", v.id);
    const ri = await prisma.projectRecordItem.findFirst({
      where: { title: { contains: t } },
      select: { id: true, fileUrl: true, projectId: true },
    });
    if (!ri) {
      sec.missing++;
      sec.diffs.push({ id: v.id, field: "(row)", legacy: "exists", migrated: "missing" });
      continue;
    }
    if (ri.fileUrl !== v.fileUrl)
      sec.diffs.push({ id: v.id, field: "fileUrl", legacy: v.fileUrl, migrated: ri.fileUrl });
    if (ri.projectId !== v.task?.projectId)
      sec.diffs.push({
        id: v.id,
        field: "projectId",
        legacy: v.task?.projectId,
        migrated: ri.projectId,
      });
    const link = await prisma.taskRequirementLink.findFirst({
      where: { taskId: v.taskId, recordItemId: ri.id },
      select: { id: true },
    });
    if (!link)
      sec.diffs.push({
        id: v.id,
        field: "TaskRequirementLink",
        legacy: "expected",
        migrated: "missing",
      });
  }

  sec.migrated = await prisma.projectRecordItem.count({
    where: { title: { contains: "[TRV:" } },
  });
}

// ─────────────────────────────────────────────────────────────────
// Driver
// ─────────────────────────────────────────────────────────────────

function printSection(label: string, s: SectionReport) {
  const status =
    s.eligible === s.migrated && s.diffs.length === 0
      ? "✅"
      : s.diffs.length > 0
      ? "⚠️"
      : "ℹ️";
  console.log(
    `  ${status} ${label.padEnd(28)} legacy=${s.legacy}  eligible=${s.eligible}  migrated=${s.migrated}  sampled=${s.sampled}  diffs=${s.diffs.length}`
  );
  for (const d of s.diffs.slice(0, 10)) {
    console.log(
      `       ↳ ${d.id} · ${d.field}: legacy=${JSON.stringify(d.legacy)} migrated=${JSON.stringify(d.migrated)}`
    );
  }
  if (s.diffs.length > 10) {
    console.log(`       ↳ … (${s.diffs.length - 10} more)`);
  }
}

async function main() {
  const { prisma } = await import("../src/lib/prisma");

  console.log(`\n🔎 Verify migration — ${report.startedAt}\n`);

  console.log("── A.1 Document ──");
  await verifyDocuments(prisma);
  printSection("Document", report.documents);

  console.log("\n── A.2 ProjectDocument ──");
  await verifyProjectDocuments(prisma);
  printSection("ProjectDocument", report.projectDocuments);

  console.log("\n── A.3 ClientDocument ──");
  await verifyClientDocuments(prisma);
  printSection("ClientDocument", report.clientDocuments);

  console.log("\n── A.4 TaskRequirementValue ──");
  await verifyTaskRequirementValues(prisma);
  printSection("TaskRequirementValue", report.taskRequirementValues);

  report.finishedAt = new Date().toISOString();

  const totalEligible =
    report.documents.eligible +
    report.projectDocuments.eligible +
    report.clientDocuments.eligible +
    report.taskRequirementValues.eligible;
  const totalMigrated =
    report.documents.migrated +
    report.projectDocuments.migrated +
    report.clientDocuments.migrated +
    report.taskRequirementValues.migrated;
  const totalDiffs =
    report.documents.diffs.length +
    report.projectDocuments.diffs.length +
    report.clientDocuments.diffs.length +
    report.taskRequirementValues.diffs.length;

  console.log("\n══════════════════════════════════════════════");
  console.log(`📊 المجموع`);
  console.log(`   مؤهل للترحيل:  ${totalEligible}`);
  console.log(`   مُرحَّل فعلاً: ${totalMigrated}`);
  console.log(`   فروقات عينة:   ${totalDiffs}`);

  const ok = totalEligible === totalMigrated && totalDiffs === 0;
  if (ok) {
    console.log(`\n✅ الترحيل متطابق — لا فروقات.\n`);
  } else if (totalEligible !== totalMigrated) {
    console.log(
      `\n⚠️  العدد لا يتطابق: مؤهل=${totalEligible} vs مُرحَّل=${totalMigrated}. شغّل --apply مرة ثانية أو راجع الأخطاء.\n`
    );
  } else {
    console.log(
      `\n⚠️  العدد متطابق لكن فيه فروقات في عينات (${totalDiffs}). راجع التقرير أعلاه.\n`
    );
  }

  if (JSON_OUT) {
    console.log("\n--- JSON REPORT ---");
    console.log(JSON.stringify(report, null, 2));
  }

  await prisma.$disconnect();
  if (!ok) process.exit(1);
}

main().catch((err) => {
  console.error("\n❌ فشل غير متوقع:", err);
  process.exit(1);
});

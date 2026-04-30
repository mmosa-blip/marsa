/* eslint-disable @typescript-eslint/no-explicit-any */
import "dotenv/config";

// ═══════════════════════════════════════════════════════════════════════
// Silent migration — legacy document tables → unified record system
// ═══════════════════════════════════════════════════════════════════════
// Phase A of "النقل الصامت":
//   A.1  Document          → ProjectRecordItem (scope=COMPLIANCE)
//   A.2  ProjectDocument   → ProjectRecordItem (scope=PROJECT) + version chain
//   A.3  ClientDocument    → ProjectRecordItem (scope=CLIENT)
//   A.4  TaskRequirementValue (with fileUrl) → ProjectRecordItem + TaskRequirementLink
//
// Default mode is DRY-RUN. Pass --apply to actually write rows.
//
//   npx tsx scripts/migrate-to-record-system.ts            # dry-run (safe)
//   npx tsx scripts/migrate-to-record-system.ts --apply    # writes rows
//   npx tsx scripts/migrate-to-record-system.ts --json     # machine-readable
//
// Idempotency: every write checks for an existing matching row first
// (anchored on stable fingerprints — see `migratedFromLegacyId` in
// titles below for the convention). Re-running is safe.
//
// Schema gaps (flagged in dry-run output, NOT silently worked around):
//   - ProjectRecordItem.projectId is NOT NULL. Documents and
//     ClientDocuments without a clear project owner cannot land
//     as-is. The dry-run prints these counts so we can choose:
//       (a) skip them (default in --apply if --skip-orphans),
//       (b) attach to the client's most recent project
//           (--attach-orphans-to-latest-project), or
//       (c) postpone until a schema migration adds nullable projectId.

const args = new Set(process.argv.slice(2));
const APPLY = args.has("--apply");
const JSON_OUT = args.has("--json");
const ATTACH_ORPHANS = args.has("--attach-orphans-to-latest-project");
const SKIP_ORPHANS = args.has("--skip-orphans");

interface MigrationStats {
  scanned: number;
  wouldMigrate: number;
  alreadyMigrated: number;
  orphanNoProject: number;
  invalidShape: number;
  written?: number;
  errors?: number;
}

interface FullReport {
  mode: "dry-run" | "apply";
  startedAt: string;
  finishedAt?: string;
  documents: MigrationStats;
  projectDocuments: MigrationStats;
  clientDocuments: MigrationStats;
  taskRequirementValues: MigrationStats;
  schemaGaps: string[];
  notes: string[];
}

function emptyStats(): MigrationStats {
  return {
    scanned: 0,
    wouldMigrate: 0,
    alreadyMigrated: 0,
    orphanNoProject: 0,
    invalidShape: 0,
    ...(APPLY ? { written: 0, errors: 0 } : {}),
  };
}

const report: FullReport = {
  mode: APPLY ? "apply" : "dry-run",
  startedAt: new Date().toISOString(),
  documents: emptyStats(),
  projectDocuments: emptyStats(),
  clientDocuments: emptyStats(),
  taskRequirementValues: emptyStats(),
  schemaGaps: [],
  notes: [],
};

// ─────────────────────────────────────────────────────────────────
// Status mapping helpers
// ─────────────────────────────────────────────────────────────────

function mapDocumentStatus(s: string): string {
  switch (s) {
    case "VALID":
    case "EXPIRING_SOON":
      return "APPROVED";
    case "EXPIRED":
      return "EXPIRED";
    case "PENDING_RENEWAL":
      return "PENDING_REVIEW";
    default:
      return "DRAFT";
  }
}

function mapDocStatus(s: string): string {
  switch (s) {
    case "APPROVED":
      return "APPROVED";
    case "REJECTED":
    case "RE_UPLOAD_REQUIRED":
      return "REJECTED";
    case "PENDING_REVIEW":
    default:
      return "PENDING_REVIEW";
  }
}

// Stable fingerprint stored in the title prefix when the legacy table
// has no clean way to round-trip the id. Used by the idempotent guard.
function legacyTag(prefix: string, id: string) {
  return `[${prefix}:${id}]`;
}

// ─────────────────────────────────────────────────────────────────
// Phase A.1 — Document  →  ProjectRecordItem (scope=COMPLIANCE)
// ─────────────────────────────────────────────────────────────────

async function migrateDocuments(prisma: any) {
  const stats = report.documents;
  const docs = await prisma.document.findMany({
    select: {
      id: true,
      title: true,
      type: true,
      customTypeName: true,
      documentNumber: true,
      issueDate: true,
      expiryDate: true,
      status: true,
      fileUrl: true,
      notes: true,
      reminderDays: true,
      isLinkedToCompany: true,
      ownerId: true,
      companyId: true,
      createdAt: true,
      owner: { select: { id: true, role: true } },
    },
  });
  stats.scanned = docs.length;

  for (const d of docs) {
    if (!d.fileUrl) {
      stats.invalidShape++;
      continue;
    }

    let projectId: string | null = null;
    if (d.owner?.role === "CLIENT" && (ATTACH_ORPHANS || !APPLY)) {
      const proj = await prisma.project.findFirst({
        where: { clientId: d.ownerId, deletedAt: null },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      projectId = proj?.id ?? null;
    }

    if (!projectId) {
      stats.orphanNoProject++;
      continue;
    }

    const tag = legacyTag("DOC", d.id);
    const existing = await prisma.projectRecordItem.findFirst({
      where: { projectId, title: { contains: tag } },
      select: { id: true },
    });
    if (existing) {
      stats.alreadyMigrated++;
      continue;
    }
    stats.wouldMigrate++;

    if (APPLY) {
      try {
        await prisma.projectRecordItem.create({
          data: {
            kind: "DOCUMENT",
            scope: "COMPLIANCE",
            status: mapDocumentStatus(d.status),
            title: `${d.title} ${tag}`,
            description: d.notes,
            fileUrl: d.fileUrl,
            expiryDate: d.expiryDate,
            reminderDays: d.reminderDays ?? null,
            projectId,
            uploadedById: d.ownerId,
            visibility: "ADMIN_ONLY",
          },
        });
        stats.written = (stats.written ?? 0) + 1;
      } catch (err) {
        stats.errors = (stats.errors ?? 0) + 1;
        console.error(`  ❌ Document ${d.id}:`, (err as Error).message);
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────
// Phase A.2 — ProjectDocument  →  ProjectRecordItem (scope=PROJECT)
// ─────────────────────────────────────────────────────────────────

async function migrateProjectDocuments(prisma: any) {
  const stats = report.projectDocuments;

  // Walk grouped by (projectId, documentTypeId, partnerId) so we can
  // chain versions cleanly. Earlier versions point forward via
  // supersededById to the next-newer one; the head row has supersededById = NULL.
  const docs = await prisma.projectDocument.findMany({
    orderBy: [
      { projectId: "asc" },
      { documentTypeId: "asc" },
      { partnerId: "asc" },
      { version: "asc" },
    ],
  });
  stats.scanned = docs.length;

  type Group = typeof docs;
  const groups = new Map<string, Group>();
  for (const d of docs) {
    const key = `${d.projectId}|${d.documentTypeId}|${d.partnerId ?? "_"}`;
    if (!groups.has(key)) groups.set(key, [] as any);
    groups.get(key)!.push(d);
  }

  for (const group of groups.values()) {
    // Walk versions oldest → newest. Create rows oldest first; once
    // we have a "previous" id, set the previous row's supersededById to
    // point at the new (head) row.
    let previousId: string | null = null;

    for (const d of group) {
      if (!d.fileUrl && !d.textData) {
        stats.invalidShape++;
        continue;
      }
      const tag = legacyTag("PD", d.id);
      const existing = await prisma.projectRecordItem.findFirst({
        where: { projectId: d.projectId, title: { contains: tag } },
        select: { id: true },
      });
      if (existing) {
        stats.alreadyMigrated++;
        previousId = existing.id;
        continue;
      }
      stats.wouldMigrate++;

      if (APPLY) {
        try {
          // Find the doc-type to inherit a clean title.
          const dt = await prisma.docType.findUnique({
            where: { id: d.documentTypeId },
            select: { name: true },
          });
          const title = `${dt?.name ?? "مستند"} v${d.version} ${tag}`;
          const created = await prisma.projectRecordItem.create({
            data: {
              kind: "DOCUMENT",
              scope: "PROJECT",
              status: mapDocStatus(d.status),
              title,
              fileUrl: d.fileUrl ?? null,
              textData: d.textData ?? null,
              projectId: d.projectId,
              partnerId: d.partnerId,
              documentTypeId: d.documentTypeId,
              uploadedById: d.uploadedById,
              reviewedById: d.reviewedById,
              reviewedAt: d.reviewedAt,
              rejectionReason: d.rejectionReason,
              uploadedOnBehalfOfClient: !!d.uploadedOnBehalfOfClient,
              isSharedWithClient: !!d.isSharedWithClient,
              visibility: d.isSharedWithClient ? "CLIENT_AND_ADMIN" : "EXECUTORS_AND_ADMIN",
            },
          });
          stats.written = (stats.written ?? 0) + 1;

          // Wire the version chain: previous → created
          if (previousId) {
            await prisma.projectRecordItem.update({
              where: { id: previousId },
              data: { supersededById: created.id },
            });
          }
          previousId = created.id;
        } catch (err) {
          stats.errors = (stats.errors ?? 0) + 1;
          console.error(`  ❌ ProjectDocument ${d.id}:`, (err as Error).message);
        }
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────
// Phase A.3 — ClientDocument  →  ProjectRecordItem (scope=CLIENT)
// ─────────────────────────────────────────────────────────────────

async function migrateClientDocuments(prisma: any) {
  const stats = report.clientDocuments;
  const docs = await prisma.clientDocument.findMany();
  stats.scanned = docs.length;

  for (const d of docs) {
    let projectId: string | null = null;
    if (ATTACH_ORPHANS || !APPLY) {
      const proj = await prisma.project.findFirst({
        where: { clientId: d.clientId, deletedAt: null },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      projectId = proj?.id ?? null;
    }
    if (!projectId) {
      stats.orphanNoProject++;
      continue;
    }

    const tag = legacyTag("CD", d.id);
    const existing = await prisma.projectRecordItem.findFirst({
      where: { projectId, title: { contains: tag } },
      select: { id: true },
    });
    if (existing) {
      stats.alreadyMigrated++;
      continue;
    }
    stats.wouldMigrate++;

    if (APPLY) {
      try {
        await prisma.projectRecordItem.create({
          data: {
            kind: "DOCUMENT",
            scope: "CLIENT",
            status: "APPROVED",
            title: `${d.title} ${tag}`,
            fileUrl: d.fileUrl,
            projectId,
            uploadedById: d.uploadedById,
            isSharedWithClient: true,
            visibility: "CLIENT_AND_ADMIN",
          },
        });
        stats.written = (stats.written ?? 0) + 1;
      } catch (err) {
        stats.errors = (stats.errors ?? 0) + 1;
        console.error(`  ❌ ClientDocument ${d.id}:`, (err as Error).message);
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────
// Phase A.4 — TaskRequirementValue (with fileUrl) → ProjectRecordItem
//             + TaskRequirementLink
// ─────────────────────────────────────────────────────────────────

async function migrateTaskRequirementValues(prisma: any) {
  const stats = report.taskRequirementValues;

  const values = await prisma.taskRequirementValue.findMany({
    where: { fileUrl: { not: null } },
    include: {
      requirement: { select: { id: true, label: true, isRequired: true } },
      task: { select: { id: true, projectId: true, serviceId: true, assigneeId: true } },
    },
  });
  stats.scanned = values.length;

  for (const v of values) {
    if (!v.fileUrl) {
      stats.invalidShape++;
      continue;
    }
    const projectId = v.task?.projectId;
    if (!projectId) {
      stats.orphanNoProject++;
      continue;
    }

    const tag = legacyTag("TRV", v.id);
    const existing = await prisma.projectRecordItem.findFirst({
      where: { projectId, title: { contains: tag } },
      select: { id: true },
    });
    if (existing) {
      stats.alreadyMigrated++;
      continue;
    }
    stats.wouldMigrate++;

    if (APPLY) {
      try {
        const created = await prisma.projectRecordItem.create({
          data: {
            kind: "DOCUMENT",
            scope: "TASK",
            status: "APPROVED",
            title: `${v.requirement?.label ?? "متطلّب مهمة"} ${tag}`,
            fileUrl: v.fileUrl,
            projectId,
            serviceId: v.task?.serviceId ?? null,
            uploadedById: v.task?.assigneeId ?? null,
            visibility: "EXECUTORS_AND_ADMIN",
          },
        });
        await prisma.taskRequirementLink.upsert({
          where: { taskId_recordItemId: { taskId: v.taskId, recordItemId: created.id } },
          create: {
            taskId: v.taskId,
            recordItemId: created.id,
            isRequired: !!v.requirement?.isRequired,
          },
          update: {},
        });
        stats.written = (stats.written ?? 0) + 1;
      } catch (err) {
        stats.errors = (stats.errors ?? 0) + 1;
        console.error(`  ❌ TaskRequirementValue ${v.id}:`, (err as Error).message);
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────
// Driver
// ─────────────────────────────────────────────────────────────────

function flagSchemaGaps() {
  if (
    report.documents.orphanNoProject > 0 ||
    report.clientDocuments.orphanNoProject > 0
  ) {
    report.schemaGaps.push(
      "ProjectRecordItem.projectId is NOT NULL — Documents and ClientDocuments without a project cannot be migrated as-is. " +
        "Pass --attach-orphans-to-latest-project to attach them to the owner's most recent project, or --skip-orphans to drop them."
    );
  }
  if (report.documents.scanned > 0 && !ATTACH_ORPHANS && !APPLY) {
    report.notes.push(
      "Compliance documents (Document table) currently have no project anchor in the new schema. The dry-run probes attach-to-latest-project to give a realistic count; --apply needs an explicit policy flag."
    );
  }
}

function printHeader(title: string) {
  console.log(`\n── ${title} ──`);
}

function printStats(label: string, s: MigrationStats) {
  console.log(`  ${label.padEnd(28)} scanned=${s.scanned}  migrate=${s.wouldMigrate}  already=${s.alreadyMigrated}  orphan=${s.orphanNoProject}  invalid=${s.invalidShape}` +
    (APPLY ? `  written=${s.written ?? 0}  errors=${s.errors ?? 0}` : ""));
}

async function main() {
  const { prisma } = await import("../src/lib/prisma");

  console.log(`\n🔁 Migration script — mode: ${APPLY ? "APPLY (writes rows)" : "DRY-RUN (no writes)"}\n`);
  if (APPLY && !ATTACH_ORPHANS && !SKIP_ORPHANS) {
    console.error(
      "❌ refusing to run --apply without an orphan policy. Pass --attach-orphans-to-latest-project OR --skip-orphans."
    );
    process.exit(1);
  }

  printHeader("A.1 — Document → ProjectRecordItem (COMPLIANCE)");
  await migrateDocuments(prisma);
  printStats("Document", report.documents);

  printHeader("A.2 — ProjectDocument → ProjectRecordItem (PROJECT) + version chain");
  await migrateProjectDocuments(prisma);
  printStats("ProjectDocument", report.projectDocuments);

  printHeader("A.3 — ClientDocument → ProjectRecordItem (CLIENT)");
  await migrateClientDocuments(prisma);
  printStats("ClientDocument", report.clientDocuments);

  printHeader("A.4 — TaskRequirementValue → ProjectRecordItem + Link");
  await migrateTaskRequirementValues(prisma);
  printStats("TaskRequirementValue", report.taskRequirementValues);

  flagSchemaGaps();
  report.finishedAt = new Date().toISOString();

  const totalWouldMigrate =
    report.documents.wouldMigrate +
    report.projectDocuments.wouldMigrate +
    report.clientDocuments.wouldMigrate +
    report.taskRequirementValues.wouldMigrate;
  const totalAlready =
    report.documents.alreadyMigrated +
    report.projectDocuments.alreadyMigrated +
    report.clientDocuments.alreadyMigrated +
    report.taskRequirementValues.alreadyMigrated;
  const totalOrphan =
    report.documents.orphanNoProject +
    report.clientDocuments.orphanNoProject +
    report.taskRequirementValues.orphanNoProject;

  console.log("\n══════════════════════════════════════════════");
  console.log(`📊 المجموع`);
  console.log(`   سيُرحَّل:        ${totalWouldMigrate}`);
  console.log(`   مُرحَّل سابقاً: ${totalAlready}`);
  console.log(`   يتيمة:          ${totalOrphan}`);
  if (APPLY) {
    const written =
      (report.documents.written ?? 0) +
      (report.projectDocuments.written ?? 0) +
      (report.clientDocuments.written ?? 0) +
      (report.taskRequirementValues.written ?? 0);
    const errors =
      (report.documents.errors ?? 0) +
      (report.projectDocuments.errors ?? 0) +
      (report.clientDocuments.errors ?? 0) +
      (report.taskRequirementValues.errors ?? 0);
    console.log(`   مكتوب:          ${written}`);
    console.log(`   أخطاء:          ${errors}`);
  }

  if (report.schemaGaps.length > 0) {
    console.log(`\n⚠️  Schema gaps:`);
    for (const g of report.schemaGaps) console.log(`   - ${g}`);
  }
  if (report.notes.length > 0) {
    console.log(`\n📝 Notes:`);
    for (const n of report.notes) console.log(`   - ${n}`);
  }

  if (JSON_OUT) {
    console.log("\n--- JSON REPORT ---");
    console.log(JSON.stringify(report, null, 2));
  }

  if (!APPLY) {
    console.log(
      `\n💡 هذه نتيجة dry-run. لإجراء الترحيل الفعلي:\n` +
        `   npx tsx scripts/migrate-to-record-system.ts --apply --attach-orphans-to-latest-project\n` +
        `   أو\n` +
        `   npx tsx scripts/migrate-to-record-system.ts --apply --skip-orphans\n`
    );
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("\n❌ فشل غير متوقع:", err);
  process.exit(1);
});

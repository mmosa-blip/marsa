/* eslint-disable @typescript-eslint/no-explicit-any */
import "dotenv/config";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

// ═══════════════════════════════════════════════════════════════════════
// Pre-migration backup — Phase A safety net
// ═══════════════════════════════════════════════════════════════════════
// Captures every table involved in the silent legacy → record-system
// migration before any write. Output:
//   backups/pre-migration-<timestamp>/data-json/<table>.json   (per-table)
//   backups/pre-migration-<timestamp>/_summary.json            (counts)
//   backups/pre-migration-<timestamp>/schema.prisma            (snapshot)
//   backups/pre-migration-<timestamp>/git-info.txt
//   backups/pre-migration-<timestamp>.tar.gz                   (compressed)
//
// Includes both the legacy tables we'll be reading from AND the new
// record-system tables (so a rollback can wipe migrated rows without
// guessing which ones came from a past migration run).

// Legacy tables we read from during migration.
const LEGACY_TABLES = [
  "document",
  "projectDocument",
  "clientDocument",
  "taskRequirement",
  "taskRequirementValue",
];

// New record-system tables we write to.
const RECORD_TABLES = [
  "projectRecordItem",
  "platformAccount",
  "platformLink",
  "projectIssue",
  "recordItemComment",
  "recordItemAuditLog",
  "taskRequirementLink",
  "serviceTemplateRequirement",
];

// Reference tables that are FK targets — we need their state for
// rollback consistency, but we don't migrate them.
const REFERENCE_TABLES = [
  "user",
  "project",
  "service",
  "task",
  "taskTemplate",
  "projectPartner",
  "docType",
  "documentGroup",
  "company",
];

const ALL_TABLES = [...LEGACY_TABLES, ...RECORD_TABLES, ...REFERENCE_TABLES];

async function main() {
  const { prisma } = await import("../src/lib/prisma");

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const dirName = `pre-migration-${timestamp}`;
  const backupDir = path.join("backups", dirName);
  const jsonDir = path.join(backupDir, "data-json");
  fs.mkdirSync(jsonDir, { recursive: true });

  console.log(`\n📦 نسخة احتياطية قبل الترحيل — ${timestamp}\n`);

  const legacyCounts: Record<string, number | string> = {};
  const recordCounts: Record<string, number | string> = {};
  const referenceCounts: Record<string, number | string> = {};
  let total = 0;

  console.log("── الجداول القديمة (legacy) ──");
  for (const table of LEGACY_TABLES) {
    const n = await dump(prisma, table, jsonDir);
    legacyCounts[table] = n;
    if (typeof n === "number") total += n;
  }

  console.log("\n── جداول السجل الجديد ──");
  for (const table of RECORD_TABLES) {
    const n = await dump(prisma, table, jsonDir);
    recordCounts[table] = n;
    if (typeof n === "number") total += n;
  }

  console.log("\n── جداول مرجعية ──");
  for (const table of REFERENCE_TABLES) {
    const n = await dump(prisma, table, jsonDir);
    referenceCounts[table] = n;
    if (typeof n === "number") total += n;
  }

  fs.writeFileSync(
    path.join(jsonDir, "_summary.json"),
    JSON.stringify(
      {
        timestamp,
        purpose: "pre-migration-record-system",
        totalRecords: total,
        legacy: legacyCounts,
        recordSystem: recordCounts,
        reference: referenceCounts,
      },
      null,
      2
    )
  );

  // Schema snapshot
  const schemaPath = path.join("prisma", "schema.prisma");
  if (fs.existsSync(schemaPath)) {
    fs.copyFileSync(schemaPath, path.join(backupDir, "schema.prisma"));
    console.log(`\n  ✅ schema.prisma`);
  }

  // Git info
  try {
    const gitLog = execSync("git log --oneline -10", { encoding: "utf-8" });
    const gitBranch = execSync("git branch --show-current", { encoding: "utf-8" }).trim();
    const gitStatus = execSync("git status --short", { encoding: "utf-8" });
    fs.writeFileSync(
      path.join(backupDir, "git-info.txt"),
      `Branch: ${gitBranch}\n\nLog:\n${gitLog}\nStatus:\n${gitStatus}`
    );
    console.log(`  ✅ git-info.txt`);
  } catch {
    console.log(`  ⏭️  git-info: skipped`);
  }

  // Compress
  const tarFile = path.join("backups", `${dirName}.tar.gz`);
  try {
    execSync(`tar -czf "${tarFile}" -C backups "${dirName}"`, {
      encoding: "utf-8",
    });
    const stat = fs.statSync(tarFile);
    const sizeKB = Math.round(stat.size / 1024);
    console.log(`\n✅ النسخة الاحتياطية جاهزة`);
    console.log(`   السجلات: ${total}`);
    console.log(`   الحجم: ${sizeKB} KB`);
    console.log(`   المسار: ${path.resolve(tarFile)}\n`);
    // Keep both the directory and the tarball so we have a fast-access
    // copy plus a portable compressed archive.
  } catch (err) {
    console.log(
      `\n⚠️  فشل ضغط الأرشيف، لكن مجلد JSON محفوظ في:\n   ${path.resolve(
        backupDir
      )}\n`
    );
    console.log(err);
  }

  await prisma.$disconnect();
}

async function dump(prisma: any, table: string, jsonDir: string) {
  try {
    const rows = await (prisma as any)[table].findMany();
    fs.writeFileSync(
      path.join(jsonDir, `${table}.json`),
      JSON.stringify(rows, null, 2)
    );
    console.log(`  ✅ ${table.padEnd(28)} ${rows.length}`);
    return rows.length;
  } catch (err: any) {
    console.log(`  ⏭️  ${table.padEnd(28)} skipped (${err?.message ?? "?"})`);
    return "skipped";
  }
}

main().catch((err) => {
  console.error("❌ فشل:", err);
  process.exit(1);
});

// Silence unused-var warning when tree-shaking
void ALL_TABLES;

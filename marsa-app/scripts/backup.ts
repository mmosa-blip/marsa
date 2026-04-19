import "dotenv/config";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const TABLES = [
  "user", "project", "task", "service", "contract",
  "invoice", "projectMilestone", "contractPaymentInstallment",
  "projectPartner", "taskAssignment", "department", "company",
  "serviceTemplate", "taskTemplate", "departmentAssignmentPool",
  "userService", "auditLog", "notification", "projectPause",
  "taskRequirement", "docType", "projectDocument",
  "paymentRequest", "taskTransferRequest", "permission", "userPermission",
];

async function backup() {
  const { prisma } = await import("../src/lib/prisma");

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const dirName = `backup-${timestamp}`;
  const backupDir = path.join("backups", dirName);
  const jsonDir = path.join(backupDir, "data-json");
  fs.mkdirSync(jsonDir, { recursive: true });

  console.log(`\n📦 نسخة احتياطية — ${timestamp}\n`);

  // 1. Export tables
  const summary: Record<string, number | string> = {};
  let totalRecords = 0;

  for (const table of TABLES) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await (prisma as any)[table].findMany();
      fs.writeFileSync(path.join(jsonDir, `${table}.json`), JSON.stringify(data, null, 2));
      summary[table] = data.length;
      totalRecords += data.length;
      console.log(`  ✅ ${table}: ${data.length}`);
    } catch {
      summary[table] = "skipped";
      console.log(`  ⏭️  ${table}: skipped`);
    }
  }

  fs.writeFileSync(path.join(jsonDir, "_summary.json"), JSON.stringify({ timestamp, totalRecords, summary }, null, 2));

  // 2. Copy schema
  const schemaPath = path.join("prisma", "schema.prisma");
  if (fs.existsSync(schemaPath)) {
    fs.copyFileSync(schemaPath, path.join(backupDir, "schema.prisma"));
    console.log(`  ✅ schema.prisma`);
  }

  // 3. Git info
  try {
    const gitLog = execSync("git log --oneline -10", { encoding: "utf-8" });
    const gitBranch = execSync("git branch --show-current", { encoding: "utf-8" }).trim();
    fs.writeFileSync(path.join(backupDir, "git-info.txt"), `Branch: ${gitBranch}\n\n${gitLog}`);
    console.log(`  ✅ git-info.txt`);
  } catch {
    console.log(`  ⏭️  git-info: skipped`);
  }

  // 4. Compress
  const tarFile = path.join("backups", `${dirName}.tar.gz`);
  execSync(`tar -czf "${tarFile}" -C backups "${dirName}"`, { encoding: "utf-8" });

  // 5. Stats
  const stat = fs.statSync(tarFile);
  const sizeKB = Math.round(stat.size / 1024);

  console.log(`\n✅ تم الانتهاء`);
  console.log(`   السجلات: ${totalRecords}`);
  console.log(`   الحجم: ${sizeKB} KB`);
  console.log(`   المسار: ${path.resolve(tarFile)}\n`);

  // Cleanup uncompressed dir
  fs.rmSync(backupDir, { recursive: true, force: true });

  await prisma.$disconnect();
}

backup().catch((err) => {
  console.error("❌ فشل:", err);
  process.exit(1);
});

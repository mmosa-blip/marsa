import "dotenv/config";

// Backfill: for every existing project that came from a template
// and has zero ContractPaymentInstallment rows, materialize the
// installments from the template's milestones.
//
// This recovers data for the 33 Investment projects (and any
// commercial ones) that were generated via /api/projects/generate
// before the route was fixed to create installments alongside
// ProjectMilestone.
//
// Resolution logic (matches the live POST handler):
//   afterServiceIndex = -1 → upfront, no link, unlocked
//   afterServiceIndex = N  → first task of service at serviceOrder = N+1
//
// Run:
//   npx tsx scripts/backfill-installments-from-templates.ts          # dry-run
//   npx tsx scripts/backfill-installments-from-templates.ts --apply  # write

const APPLY = process.argv.includes("--apply");

interface Stats {
  projectsScanned: number;
  projectsHandled: number;
  projectsSkippedAlreadyHasInstallments: number;
  projectsSkippedNoTemplate: number;
  projectsSkippedNoMilestones: number;
  projectsSkippedNoContract: number;
  installmentsCreated: number;
  contractsValueBackfilled: number;
  failures: { project: string; reason: string }[];
}

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  const stats: Stats = {
    projectsScanned: 0,
    projectsHandled: 0,
    projectsSkippedAlreadyHasInstallments: 0,
    projectsSkippedNoTemplate: 0,
    projectsSkippedNoMilestones: 0,
    projectsSkippedNoContract: 0,
    installmentsCreated: 0,
    contractsValueBackfilled: 0,
    failures: [],
  };

  console.log(`Mode: ${APPLY ? "APPLY (writes to DB)" : "DRY-RUN (read-only)"}\n`);

  const projects = await prisma.project.findMany({
    where: { deletedAt: null, templateId: { not: null } },
    select: {
      id: true,
      name: true,
      contractId: true,
      templateId: true,
      template: {
        select: {
          id: true,
          name: true,
          milestones: { orderBy: { order: "asc" } },
        },
      },
      services: {
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
        where: { deletedAt: null },
        orderBy: { serviceOrder: "asc" },
      },
    },
  });

  for (const p of projects) {
    stats.projectsScanned++;

    if (!p.template) {
      stats.projectsSkippedNoTemplate++;
      continue;
    }
    const billable = p.template.milestones.filter((m) => m.amount > 0);
    if (billable.length === 0) {
      stats.projectsSkippedNoMilestones++;
      continue;
    }
    if (!p.contractId) {
      stats.projectsSkippedNoContract++;
      stats.failures.push({
        project: p.name,
        reason: "project has no contractId — cannot attach installments",
      });
      continue;
    }

    const existingCount = await prisma.contractPaymentInstallment.count({
      where: { contractId: p.contractId },
    });
    if (existingCount > 0) {
      stats.projectsSkippedAlreadyHasInstallments++;
      continue;
    }

    const totalSum = billable.reduce((s, m) => s + m.amount, 0);
    const created: { title: string; amount: number; linkedTaskId: string | null }[] = [];

    console.log(`▶ ${p.name}`);
    console.log(`    template: ${p.template.name} | contract: ${p.contractId} | milestones: ${billable.length}`);

    for (let mi = 0; mi < billable.length; mi++) {
      const tm = billable[mi];
      const isUpfront = tm.afterServiceIndex === -1;
      let linkedTaskId: string | null = null;

      if (!isUpfront) {
        const nextService = p.services[tm.afterServiceIndex + 1];
        const firstTaskOfNext = nextService?.tasks[0];
        if (firstTaskOfNext) {
          linkedTaskId = firstTaskOfNext.id;
        } else {
          console.warn(
            `    ⚠ milestone "${tm.title}" afterServiceIndex=${tm.afterServiceIndex} has no service/task — leaving linkedTaskId null`
          );
        }
      }

      const data = {
        contractId: p.contractId,
        title: tm.title,
        amount: tm.amount,
        order: mi,
        percentage: totalSum > 0 ? (tm.amount / totalSum) * 100 : null,
        dueAfterDays: null,
        isLocked: isUpfront ? false : mi > 0,
        ...(linkedTaskId ? { linkedTaskId } : {}),
      };

      console.log(
        `    + ${tm.title} | amount=${tm.amount} | afterIdx=${tm.afterServiceIndex} | linkedTaskId=${linkedTaskId ?? "null"}`
      );

      if (APPLY) {
        try {
          await prisma.contractPaymentInstallment.create({ data });
          stats.installmentsCreated++;
          created.push({ title: tm.title, amount: tm.amount, linkedTaskId });
        } catch (e) {
          stats.failures.push({
            project: p.name,
            reason: `installment create failed: ${e instanceof Error ? e.message : String(e)}`,
          });
          console.error("    ✗ create failed:", e);
        }
      } else {
        stats.installmentsCreated++; // dry-run preview count
        created.push({ title: tm.title, amount: tm.amount, linkedTaskId });
      }
    }

    // Backfill contractValue if missing/zero
    if (APPLY) {
      const r = await prisma.contract.updateMany({
        where: {
          id: p.contractId,
          OR: [{ contractValue: null }, { contractValue: 0 }],
        },
        data: { contractValue: totalSum },
      });
      if (r.count > 0) stats.contractsValueBackfilled++;
    } else {
      // Preview
      const c = await prisma.contract.findUnique({
        where: { id: p.contractId },
        select: { contractValue: true },
      });
      if (c?.contractValue == null || c.contractValue === 0) {
        stats.contractsValueBackfilled++;
        console.log(`    → would set contract.contractValue = ${totalSum}`);
      }
    }

    stats.projectsHandled++;
  }

  console.log("\n=== SUMMARY ===");
  console.log(`Mode                                  : ${APPLY ? "APPLY" : "DRY-RUN"}`);
  console.log(`Projects scanned                      : ${stats.projectsScanned}`);
  console.log(`Projects handled                      : ${stats.projectsHandled}`);
  console.log(`Skipped — already has installments    : ${stats.projectsSkippedAlreadyHasInstallments}`);
  console.log(`Skipped — no template                 : ${stats.projectsSkippedNoTemplate}`);
  console.log(`Skipped — template has no milestones  : ${stats.projectsSkippedNoMilestones}`);
  console.log(`Skipped — no contractId               : ${stats.projectsSkippedNoContract}`);
  console.log(`Installments ${APPLY ? "created" : "to create"}             : ${stats.installmentsCreated}`);
  console.log(`Contracts ${APPLY ? "value-backfilled" : "needing value backfill"}        : ${stats.contractsValueBackfilled}`);
  if (stats.failures.length > 0) {
    console.log(`\nFailures (${stats.failures.length}):`);
    for (const f of stats.failures) {
      console.log(`  - ${f.project}: ${f.reason}`);
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Backfill failed:", e);
  process.exit(1);
});

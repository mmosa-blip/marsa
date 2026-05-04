import "dotenv/config";

// One-shot backfill: fill Contract.contractValue for legacy contracts
// that lost (or never had) the field, using two heuristics:
//   1. Project.totalPrice when > 0 — the value the user originally
//      entered into the project form ended up there, not on the
//      contract.
//   2. Sum of ContractPaymentInstallment.amount when totalPrice is
//      missing too — for contracts whose installments were entered
//      manually but the parent contract row was never priced.
//
// The script never overwrites a non-null contractValue.
//
// Run: npx tsx scripts/backfill-contract-value.ts

async function main() {
  const { prisma } = await import("../src/lib/prisma");

  let updatedFromProject = 0;
  let updatedFromInstallments = 0;
  let skipped = 0;

  // ─── Case 1: contract.contractValue null but linked project.totalPrice > 0
  //
  // Note: Project.contractId points to a contract via the
  // "ProjectContract" relation, exposed on Contract as `linkedProjects`.
  // We pick the highest totalPrice if multiple projects share a
  // contract (rare but possible).
  const candidatesByProject = await prisma.contract.findMany({
    where: {
      contractValue: null,
      linkedProjects: { some: { totalPrice: { gt: 0 } } },
    },
    include: {
      linkedProjects: {
        select: { id: true, name: true, totalPrice: true },
        orderBy: { totalPrice: "desc" },
      },
    },
  });

  console.log(`Case 1 — contracts with linked project.totalPrice: ${candidatesByProject.length}`);
  for (const c of candidatesByProject) {
    const top = c.linkedProjects[0];
    if (!top || !top.totalPrice || top.totalPrice <= 0) {
      skipped++;
      continue;
    }
    await prisma.contract.update({
      where: { id: c.id },
      data: { contractValue: top.totalPrice },
    });
    updatedFromProject++;
    console.log(`  ✓ #${c.contractNumber ?? "—"} ← ${top.name}: ${top.totalPrice}`);
  }

  // ─── Case 2: contract.contractValue still null but installments exist
  //
  // After case 1 we may still have contracts without a value but with
  // a manual installment schedule. Sum the installments to recover the
  // original total.
  const candidatesByInstallments = await prisma.contract.findMany({
    where: {
      contractValue: null,
      installments: { some: {} },
    },
    include: {
      installments: { select: { amount: true } },
      client: { select: { name: true } },
    },
  });

  console.log(`\nCase 2 — contracts with installments but still no value: ${candidatesByInstallments.length}`);
  for (const c of candidatesByInstallments) {
    const sum = c.installments.reduce((a, i) => a + Number(i.amount || 0), 0);
    if (sum <= 0) {
      skipped++;
      continue;
    }
    await prisma.contract.update({
      where: { id: c.id },
      data: { contractValue: sum },
    });
    updatedFromInstallments++;
    console.log(`  ✓ #${c.contractNumber ?? "—"} ← ${c.client?.name ?? "client?"}: sum=${sum} (${c.installments.length} installments)`);
  }

  console.log("\n=== SUMMARY ===");
  console.log(`Updated from project.totalPrice : ${updatedFromProject}`);
  console.log(`Updated from installment sums   : ${updatedFromInstallments}`);
  console.log(`Skipped (zero values)           : ${skipped}`);
  console.log(`TOTAL updated                   : ${updatedFromProject + updatedFromInstallments}`);

  // Final state
  const stillMissing = await prisma.contract.count({
    where: { contractValue: null, status: { not: "CANCELLED" } },
  });
  const withValue = await prisma.contract.count({
    where: { contractValue: { gt: 0 } },
  });
  console.log(`\nContracts still missing value (active): ${stillMissing}`);
  console.log(`Contracts with contractValue > 0       : ${withValue}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Backfill failed:", e);
  process.exit(1);
});

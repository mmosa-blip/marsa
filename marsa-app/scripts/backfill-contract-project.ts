import "dotenv/config";

// One-shot: for every Contract with projectId=null, find a Project
// whose contractId points at this contract, and set the reverse side.
// This recovers the relation that template-driven creation never
// populated, so /api/payments can resolve project info via the
// straight reverse lookup.
//
// Run:
//   npx tsx scripts/backfill-contract-project.ts          # dry-run
//   npx tsx scripts/backfill-contract-project.ts --apply  # write

const APPLY = process.argv.includes("--apply");

async function main() {
  const { prisma } = await import("../src/lib/prisma");

  const orphanContracts = await prisma.contract.findMany({
    where: { projectId: null },
    select: {
      id: true,
      contractNumber: true,
      status: true,
      client: { select: { name: true } },
      linkedProjects: {
        where: { deletedAt: null },
        select: { id: true, name: true, deletedAt: true, createdAt: true },
        // Pick the most recently-created in case of conflicts.
        orderBy: { createdAt: "desc" },
      },
    },
  });

  console.log(`Mode: ${APPLY ? "APPLY" : "DRY-RUN"}\n`);
  console.log(`Contracts with projectId=null: ${orphanContracts.length}`);

  let updated = 0;
  let skippedNoLinkedProject = 0;
  let skippedMultipleLinked = 0;

  for (const c of orphanContracts) {
    const candidates = c.linkedProjects;
    if (candidates.length === 0) {
      skippedNoLinkedProject++;
      continue;
    }
    if (candidates.length > 1) {
      console.log(
        `  ⚠ contract #${c.contractNumber ?? "—"} (${c.client?.name ?? "?"}) has ${candidates.length} linkedProjects — picking newest`
      );
      skippedMultipleLinked++;
    }
    const target = candidates[0];

    console.log(
      `  ${APPLY ? "✓" : "→"} #${c.contractNumber ?? "—"} ← project ${target.name}`
    );

    if (APPLY) {
      await prisma.contract.update({
        where: { id: c.id },
        data: { projectId: target.id },
      });
    }
    updated++;
  }

  console.log("\n=== SUMMARY ===");
  console.log(`Mode                        : ${APPLY ? "APPLY" : "DRY-RUN"}`);
  console.log(`Total orphan contracts      : ${orphanContracts.length}`);
  console.log(`${APPLY ? "Updated" : "Would update"}                : ${updated}`);
  console.log(`Skipped — no linked project : ${skippedNoLinkedProject}`);
  console.log(`Multi-linked (took newest)  : ${skippedMultipleLinked}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Backfill failed:", e);
  process.exit(1);
});

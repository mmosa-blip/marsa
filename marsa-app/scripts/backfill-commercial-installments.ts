import "dotenv/config";

// Backfill: create one 100% ContractPaymentInstallment per project
// that has a contract but no schedule yet — the leftover commercial
// projects from before the new-project flow started enforcing an
// inline payment schedule.
//
// Resolution per project:
//   1. amount  = contract.contractValue ?? project.totalPrice
//      (skip with a warning if both are null/0)
//   2. linked task = LAST task of the LAST service (by serviceOrder
//      then task order). Falls back to "no link, upfront" if the
//      project somehow has no services with tasks.
//   3. ContractPaymentInstallment:
//        title       = "الدفعة الكاملة"
//        amount      = the resolved value
//        percentage  = 100
//        order       = 0
//        isLocked    = false   (admin can edit freely later)
//        linkedTaskId = last task or null
//   4. Mirror onto contract.contractValue when null.
//   5. Audit log: INSTALLMENT_BACKFILLED
//
// Run:
//   npx tsx scripts/backfill-commercial-installments.ts          # dry-run
//   npx tsx scripts/backfill-commercial-installments.ts --apply  # write

const APPLY = process.argv.includes("--apply");

interface FailureRow {
  project: string;
  reason: string;
}

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  const { createAuditLog, AuditModule } = await import("../src/lib/audit");

  console.log(`Mode: ${APPLY ? "APPLY (writes to DB)" : "DRY-RUN (read-only)"}\n`);

  // Eligible: live project, has a contract, contract has zero installments.
  const projects = await prisma.project.findMany({
    where: {
      deletedAt: null,
      contractId: { not: null },
      contract: { is: { installments: { none: {} } } },
    },
    select: {
      id: true,
      name: true,
      totalPrice: true,
      contractId: true,
      client: { select: { id: true, name: true } },
      contract: {
        select: {
          id: true,
          contractNumber: true,
          contractValue: true,
          status: true,
        },
      },
      template: { select: { name: true } },
      services: {
        where: { deletedAt: null },
        select: {
          id: true,
          name: true,
          serviceOrder: true,
          tasks: {
            select: { id: true, title: true, order: true },
            orderBy: { order: "desc" },
            take: 1,
          },
        },
        orderBy: { serviceOrder: "desc" },
      },
    },
  });

  console.log(`Eligible projects (have contract + zero installments): ${projects.length}`);

  let processed = 0;
  let installmentsCreated = 0;
  let contractValueBackfilled = 0;
  let skippedNoValue = 0;
  let skippedNoTasks = 0;
  const failures: FailureRow[] = [];
  const audit: string[] = [];

  for (const p of projects) {
    const value =
      (p.contract?.contractValue && p.contract.contractValue > 0
        ? p.contract.contractValue
        : null) ??
      (p.totalPrice && p.totalPrice > 0 ? p.totalPrice : null);

    if (!value) {
      skippedNoValue++;
      console.log(
        `  ⏭  ${p.name} (${p.client?.name ?? "?"}) — no value on contract or project, skipped`
      );
      continue;
    }

    // Walk services in reverse order, pick the first one that has a task.
    const lastSvcWithTask = p.services.find((s) => s.tasks.length > 0);
    const lastTask = lastSvcWithTask?.tasks[0] ?? null;
    if (!lastTask) {
      skippedNoTasks++;
      console.log(
        `  ⚠ ${p.name} — no service with tasks, will create unlocked upfront-style row`
      );
    }

    console.log(
      `  ${APPLY ? "✓" : "→"} ${p.name} (${p.client?.name ?? "?"}) ` +
        `| value=${value} ` +
        `| linkedTask=${lastTask ? `"${lastTask.title}"` : "null"} ` +
        `| service=${lastSvcWithTask?.name ?? "—"}`
    );

    if (APPLY) {
      try {
        const created = await prisma.contractPaymentInstallment.create({
          data: {
            contractId: p.contractId!,
            title: "الدفعة الكاملة",
            amount: value,
            percentage: 100,
            order: 0,
            isLocked: false,
            ...(lastTask ? { linkedTaskId: lastTask.id } : {}),
          },
        });
        installmentsCreated++;

        if (
          p.contract?.contractValue == null ||
          p.contract.contractValue === 0
        ) {
          await prisma.contract.update({
            where: { id: p.contractId! },
            data: { contractValue: value },
          });
          contractValueBackfilled++;
        }

        await createAuditLog({
          action: "INSTALLMENT_BACKFILLED",
          module: AuditModule.FINANCE,
          severity: "INFO",
          entityType: "ContractPaymentInstallment",
          entityId: created.id,
          entityName: `${p.name} — الدفعة الكاملة`,
          meta: {
            reason: "commercial_template_no_milestones",
            amount: value,
            taskId: lastTask?.id ?? null,
            projectId: p.id,
            contractId: p.contractId,
            template: p.template?.name ?? null,
          },
          notes: "Backfill via scripts/backfill-commercial-installments.ts",
        });
        audit.push(
          `INSTALLMENT_BACKFILLED installment=${created.id} project=${p.name} amount=${value} task=${lastTask?.id ?? "null"}`
        );
        processed++;
      } catch (e) {
        failures.push({
          project: p.name,
          reason: e instanceof Error ? e.message : String(e),
        });
        console.error(`    ✗ failed: ${e instanceof Error ? e.message : e}`);
      }
    } else {
      processed++; // dry-run preview
    }
  }

  console.log("\n=== SUMMARY ===");
  console.log(`Mode                              : ${APPLY ? "APPLY" : "DRY-RUN"}`);
  console.log(`Eligible projects scanned         : ${projects.length}`);
  console.log(`Projects ${APPLY ? "processed" : "to process"}              : ${processed}`);
  console.log(`Skipped — no value anywhere       : ${skippedNoValue}`);
  console.log(`Projects with no linked task      : ${skippedNoTasks}`);
  console.log(`Installments ${APPLY ? "created" : "to create"}             : ${APPLY ? installmentsCreated : processed}`);
  console.log(`Contract.contractValue ${APPLY ? "filled" : "to fill"}      : ${APPLY ? contractValueBackfilled : "—"}`);
  if (failures.length > 0) {
    console.log(`\nFailures (${failures.length}):`);
    for (const f of failures) console.log(`  - ${f.project}: ${f.reason}`);
  }
  if (APPLY && audit.length > 0) {
    console.log(`\nAudit log entries written: ${audit.length}`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Backfill failed:", e);
  process.exit(1);
});

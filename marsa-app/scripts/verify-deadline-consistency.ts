/**
 * Cross-check that every consumer of "project deadline" agrees on the
 * same answer for every project. After the deadline-helper unification,
 * city / health / operations should all read the SAME effective end-date
 * via getEffectiveDeadline.
 *
 * Walks the same projects all three layers query and reports any case
 * where their answers diverge — so a regression like "city says منهار,
 * health says مرتاح" can never sneak back in unnoticed.
 *
 * Run with:  npx tsx scripts/verify-deadline-consistency.ts
 */
import "dotenv/config";

(async () => {
  const { prisma } = await import("../src/lib/prisma");
  const { getEffectiveDeadline, daysRemainingForProject, isProjectOverdue } =
    await import("../src/lib/project-deadline");
  const { getBuildingState, isProjectComplete } = await import("../src/lib/city-state");

  const now = Date.now();

  const projects = await prisma.project.findMany({
    where: { deletedAt: null, status: { not: "COMPLETED" } },
    include: {
      contract: { select: { endDate: true } },
      services: {
        where: { deletedAt: null },
        select: { id: true, tasks: { select: { status: true } } },
      },
      tasks: { select: { status: true, dueDate: true } },
    },
  });

  let agree = 0;
  let disagree = 0;
  const anomalies: string[] = [];

  for (const p of projects) {
    const deadline = getEffectiveDeadline(p);
    const overdueByHelper = isProjectOverdue(p, now);
    const daysLeft = daysRemainingForProject(p, now);
    const isComplete = isProjectComplete(p);
    const state = getBuildingState({ ...p, isComplete });

    // Invariants every consumer must satisfy:
    //   1. overdue => daysRemaining === 0
    //   2. overdue && !isComplete => COLLAPSED
    //   3. !overdue => state !== COLLAPSED
    //   4. deadline === null => !overdue && daysRemaining === 0
    const checks: { name: string; ok: boolean }[] = [
      { name: "overdue⇒daysRemaining=0", ok: !overdueByHelper || daysLeft === 0 },
      {
        name: "overdue+!complete⇒COLLAPSED",
        ok: !(overdueByHelper && !isComplete) || state === "COLLAPSED",
      },
      { name: "!overdue⇒not COLLAPSED", ok: overdueByHelper || state !== "COLLAPSED" },
      {
        name: "no-deadline⇒not overdue",
        ok: deadline !== null || (!overdueByHelper && daysLeft === 0),
      },
    ];

    const failed = checks.filter((c) => !c.ok);
    if (failed.length === 0) {
      agree++;
    } else {
      disagree++;
      anomalies.push(
        `[${p.name}] ${failed.map((c) => c.name).join(", ")} — state=${state} daysLeft=${daysLeft} overdue=${overdueByHelper}`,
      );
    }
  }

  console.log(`=== ${projects.length} مشروع ===`);
  console.log(`  ✅ متّسق: ${agree}`);
  console.log(`  ❌ متعارض: ${disagree}`);
  if (anomalies.length > 0) {
    console.log("\n== الحالات المتعارضة ==");
    for (const a of anomalies) console.log("  -", a);
  }

  await prisma.$disconnect();
  if (disagree > 0) process.exit(1);
})();

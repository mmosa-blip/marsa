import "dotenv/config";

(async () => {
  const { prisma } = await import("../src/lib/prisma");
  const { getBuildingState, isProjectComplete } = await import("../src/lib/city-state");

  const now = Date.now();

  const projects = await prisma.project.findMany({
    where: { deletedAt: null, status: { not: "COMPLETED" } },
    select: {
      id: true,
      name: true,
      status: true,
      isPaused: true,
      startDate: true,
      endDate: true,
      contractStartDate: true,
      contractEndDate: true,
      createdAt: true,
      contract: { select: { startDate: true, endDate: true } },
      services: {
        where: { deletedAt: null },
        select: { id: true, tasks: { select: { status: true } } },
      },
      tasks: { select: { status: true, dueDate: true } },
    },
  });

  console.log(`=== ${projects.length} مشروع غير مكتمل ===\n`);

  const ms = (d: unknown) => (d instanceof Date ? d.getTime() : null);
  const fmt = (t: number | null) =>
    t === null ? "null" : new Date(t).toISOString().slice(0, 10);

  // Different "deadline source" candidates and what each says today.
  let endDateBlown = 0;
  let contractEndBlown = 0;
  let contractRelationBlown = 0;
  let helperSaysCollapsed = 0;
  // The interesting bucket: contract is past but project.endDate isn't.
  const ghosts: typeof projects = [];

  for (const p of projects) {
    const projEnd = ms(p.endDate);
    const projContractEnd = ms(p.contractEndDate);
    const linkedContractEnd = ms(p.contract?.endDate ?? null);

    const a = projEnd !== null && projEnd < now;
    const b = projContractEnd !== null && projContractEnd < now;
    const c = linkedContractEnd !== null && linkedContractEnd < now;

    if (a) endDateBlown++;
    if (b) contractEndBlown++;
    if (c) contractRelationBlown++;

    const isComplete = isProjectComplete(p);
    const state = getBuildingState({ ...p, isComplete });
    if (state === "COLLAPSED") helperSaysCollapsed++;

    // "ghost" — at least one source says expired but the helper isn't COLLAPSED.
    const anyBlown = a || b || c;
    if (anyBlown && state !== "COLLAPSED") ghosts.push(p);
  }

  console.log("== كم مشروع تجاوز deadline ==");
  console.log("  project.endDate < now:        ", endDateBlown);
  console.log("  project.contractEndDate < now:", contractEndBlown);
  console.log("  contract.endDate < now:       ", contractRelationBlown);
  console.log("  getBuildingState → COLLAPSED: ", helperSaysCollapsed);

  console.log(`\n== ${ghosts.length} مشروع: مصدر يقول منهار، الـhelper ما يراه ==`);
  for (const p of ghosts) {
    const projEnd = ms(p.endDate);
    const projContractEnd = ms(p.contractEndDate);
    const linkedContractEnd = ms(p.contract?.endDate ?? null);
    console.log(`\n[${p.name}]  status=${p.status}`);
    console.log("  project.endDate:        ", fmt(projEnd), projEnd && projEnd < now ? "PAST 🔴" : "future");
    console.log("  project.contractEndDate:", fmt(projContractEnd), projContractEnd && projContractEnd < now ? "PAST 🔴" : "future");
    console.log("  contract.endDate:       ", fmt(linkedContractEnd), linkedContractEnd && linkedContractEnd < now ? "PAST 🔴" : "future");
  }

  await prisma.$disconnect();
})();

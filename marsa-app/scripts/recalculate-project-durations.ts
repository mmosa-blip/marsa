/**
 * One-shot recalculation of project.endDate for every active project
 * using the new computeProjectDuration critical-path rule. Runs in
 * dry-run mode by default: prints before/after for each project and
 * exits without touching the DB. Pass --apply to actually write the
 * new endDate back.
 *
 * Usage:
 *   npx tsx scripts/recalculate-project-durations.ts          # dry run
 *   npx tsx scripts/recalculate-project-durations.ts --apply  # write
 */
import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import { addWorkingDays } from '../src/lib/working-days';
import { computeProjectDuration } from '../src/lib/service-duration';

const APPLY = process.argv.includes('--apply');

type Row = {
  id: string;
  name: string;
  startDate: Date;
  oldEndDate: Date | null;
  newEndDate: Date;
  oldWorkingDays: number | null;
  newWorkingDays: number;
  driftDays: number | null;
  notes: string[];
};

function workingDaysBetween(start: Date, end: Date): number {
  let count = 0;
  const d = new Date(start);
  while (d < end) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 6) count++;
  }
  return count;
}

(async () => {
  const projects = await prisma.project.findMany({
    where: {
      deletedAt: null,
      status: { notIn: ['CANCELLED', 'COMPLETED'] },
    },
    select: {
      id: true,
      name: true,
      startDate: true,
      endDate: true,
      services: {
        select: {
          id: true,
          name: true,
          duration: true,
          executionMode: true,
          isBackground: true,
          serviceOrder: true,
          serviceTemplateId: true,
          serviceTemplate: {
            select: {
              defaultDuration: true,
              taskTemplates: { select: { defaultDuration: true } },
            },
          },
        },
        orderBy: { serviceOrder: 'asc' },
      },
    },
  });

  const rows: Row[] = [];

  for (const p of projects) {
    const notes: string[] = [];
    if (!p.startDate) {
      notes.push('SKIP: no startDate');
      continue;
    }
    if (p.services.length === 0) {
      notes.push('SKIP: no services');
      continue;
    }

    const serviceInputs = p.services.map((s) => {
      // Prefer the instance duration if set; fall back to the template's
      // defaultDuration; finally sum the template's task durations. This
      // matches the resolution order used in the fixed generate/route.ts.
      const fromTemplate =
        s.serviceTemplate?.defaultDuration ??
        s.serviceTemplate?.taskTemplates.reduce((sum, t) => sum + (t.defaultDuration || 0), 0) ??
        0;
      const duration = s.duration ?? fromTemplate;
      if (!s.duration && fromTemplate > 0) {
        notes.push(`svc "${s.name}": duration was null, using template fallback=${fromTemplate}`);
      }
      return {
        duration,
        executionMode: s.executionMode as string,
        isBackground: s.isBackground,
      };
    });

    const newDurationDays = computeProjectDuration(serviceInputs);
    const newEndDate = addWorkingDays(new Date(p.startDate), newDurationDays);
    const oldWorkingDays = p.endDate ? workingDaysBetween(new Date(p.startDate), new Date(p.endDate)) : null;
    const driftDays = oldWorkingDays !== null ? oldWorkingDays - newDurationDays : null;

    rows.push({
      id: p.id,
      name: p.name,
      startDate: p.startDate,
      oldEndDate: p.endDate,
      newEndDate,
      oldWorkingDays,
      newWorkingDays: newDurationDays,
      driftDays,
      notes,
    });
  }

  rows.sort((a, b) => Math.abs(b.driftDays ?? 0) - Math.abs(a.driftDays ?? 0));

  console.log(`Mode: ${APPLY ? 'APPLY (will write)' : 'DRY RUN (no writes)'}`);
  console.log(`Projects scanned: ${rows.length}\n`);

  for (const r of rows) {
    const driftLabel =
      r.driftDays === null ? '—'
      : r.driftDays === 0 ? '(no change)'
      : r.driftDays > 0 ? `shortens by ${r.driftDays}d`
      : `lengthens by ${Math.abs(r.driftDays)}d`;
    console.log(`[${r.id}] ${r.name}`);
    console.log(`  old: ${r.oldEndDate?.toISOString().slice(0, 10) ?? '(null)'} (${r.oldWorkingDays ?? '?'} wd)  →  new: ${r.newEndDate.toISOString().slice(0, 10)} (${r.newWorkingDays} wd)  ${driftLabel}`);
    if (r.notes.length > 0) r.notes.forEach((n) => console.log(`  • ${n}`));
  }

  const nonZeroDrift = rows.filter((r) => r.driftDays !== 0 && r.driftDays !== null).length;
  console.log(`\nSummary: ${nonZeroDrift}/${rows.length} projects would change.`);

  if (APPLY) {
    console.log('\nApplying changes...');
    let updated = 0;
    for (const r of rows) {
      if (r.oldEndDate && r.newEndDate.getTime() === new Date(r.oldEndDate).getTime()) continue;
      await prisma.project.update({
        where: { id: r.id },
        data: { endDate: r.newEndDate },
      });
      updated++;
    }
    console.log(`Updated ${updated} projects.`);
  } else {
    console.log('\nDry run only. Re-run with --apply to write changes.');
  }

  await prisma.$disconnect();
})();

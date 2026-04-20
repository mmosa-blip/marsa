import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

(async () => {
  console.log('=== FATIH بالتفصيل ===');
  const fatih = await prisma.project.findFirst({
    where: { name: { contains: 'FATIH' } },
    select: { name: true, startDate: true, endDate: true, status: true, deletedAt: true },
  });
  if (fatih) {
    const cal = Math.ceil((new Date(fatih.endDate!).getTime() - new Date(fatih.startDate!).getTime()) / (1000 * 60 * 60 * 24));
    let wd = 0;
    const d = new Date(fatih.startDate!);
    while (d < new Date(fatih.endDate!)) {
      d.setDate(d.getDate() + 1);
      if (d.getDay() !== 6) wd++;
    }
    console.log(`  name: ${fatih.name}`);
    console.log(`  startDate: ${fatih.startDate?.toISOString().slice(0, 10)}`);
    console.log(`  endDate:   ${fatih.endDate?.toISOString().slice(0, 10)}`);
    console.log(`  calendar days: ${cal}`);
    console.log(`  working days:  ${wd}`);
  }

  console.log('\n=== المشاريع التي لها خدمات مرتبطة بقالب ===');
  const projects = await prisma.project.findMany({
    where: {
      services: { some: { serviceTemplateId: { not: null } } },
    },
    select: { name: true, projectCode: true, status: true, deletedAt: true, startDate: true, endDate: true },
    orderBy: { name: 'asc' },
  });
  projects.forEach((p) => {
    const days =
      p.startDate && p.endDate
        ? Math.ceil((new Date(p.endDate).getTime() - new Date(p.startDate).getTime()) / (1000 * 60 * 60 * 24))
        : '—';
    const flags = [
      p.deletedAt ? 'DELETED' : null,
      p.status !== 'ACTIVE' ? `status=${p.status}` : null,
    ].filter(Boolean).join(' ');
    console.log(`  ${p.name} ${p.projectCode ? `(${p.projectCode})` : ''} → ${days} calendar days ${flags ? `[${flags}]` : ''}`);
  });

  await prisma.$disconnect();
})();

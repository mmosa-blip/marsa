import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

(async () => {
  const names = ['تجربة', 'جديد 2', 'محمود محمد'];

  for (const n of names) {
    const list = await prisma.project.findMany({
      where: { name: { contains: n } },
      select: {
        id: true,
        name: true,
        projectCode: true,
        deletedAt: true,
        status: true,
        updatedAt: true,
        createdAt: true,
        _count: { select: { tasks: true, services: true } },
      },
    });

    if (list.length === 0) {
      console.log(`\n"${n}" → لا يوجد`);
      continue;
    }
    for (const p of list) {
      console.log(`\n"${p.name}" ${p.projectCode ? `(${p.projectCode})` : ''}`);
      console.log('  id:', p.id);
      console.log('  deletedAt:', p.deletedAt);
      console.log('  status:', p.status);
      console.log('  createdAt:', p.createdAt);
      console.log('  updatedAt:', p.updatedAt);
      console.log('  services:', p._count.services, '| tasks:', p._count.tasks);
    }
  }

  await prisma.$disconnect();
})();

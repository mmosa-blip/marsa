import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

(async () => {
  const candidates = await prisma.service.findMany({
    where: {
      isBackground: false,
      OR: [
        { name: { contains: 'خلفية' } },
        { name: { contains: 'background', mode: 'insensitive' } },
        { name: { contains: 'شحن' } },
        { name: { contains: 'أرشفة' } },
      ],
    },
    select: {
      id: true,
      name: true,
      isBackground: true,
      executionMode: true,
      duration: true,
      serviceOrder: true,
      projectId: true,
      project: { select: { name: true, projectCode: true } },
    },
    orderBy: [{ projectId: 'asc' }, { serviceOrder: 'asc' }],
  });

  console.log(`عدد المرشحين: ${candidates.length}`);
  console.log('');
  candidates.forEach((s, i) => {
    console.log(`${i + 1}. "${s.name}"`);
    console.log(`   المشروع: ${s.project?.name || '(بلا اسم)'} ${s.project?.projectCode ? `(${s.project.projectCode})` : ''}`);
    console.log(`   mode: ${s.executionMode} | duration: ${s.duration} | isBackground: ${s.isBackground}`);
    console.log(`   serviceId: ${s.id}`);
    console.log('');
  });

  await prisma.$disconnect();
})();

import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

(async () => {
  const p = await prisma.project.findFirst({
    where: { name: { contains: 'FATIH' } },
    include: {
      services: {
        select: { name: true, duration: true, executionMode: true, isBackground: true, serviceTemplateId: true, serviceOrder: true },
        orderBy: { serviceOrder: 'asc' },
      },
    },
  });
  if (!p) { console.log('NOT FOUND'); await prisma.$disconnect(); return; }
  console.log('بعد الإصلاح:');
  p.services.forEach((s) => {
    console.log(`[${s.serviceOrder}] ${s.name} | dur:${s.duration} | mode:${s.executionMode} | bg:${s.isBackground} | linked:${!!s.serviceTemplateId}`);
  });
  await prisma.$disconnect();
})();

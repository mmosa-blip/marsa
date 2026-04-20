import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

(async () => {
  const toFix = await prisma.service.findMany({
    where: {
      isBackground: false,
      OR: [
        { name: { contains: 'خلفية' } },
        { name: { contains: 'background', mode: 'insensitive' } },
        { name: { contains: 'شحن' } },
        { name: { contains: 'أرشفة' } },
      ],
    },
    select: { id: true, name: true, project: { select: { name: true } } },
  });

  console.log(`سيتم تحديث ${toFix.length} خدمة`);
  for (const s of toFix) {
    await prisma.service.update({
      where: { id: s.id },
      data: { isBackground: true },
    });
    console.log(`  ✅ ${s.name} (${s.project?.name})`);
  }
  console.log('\nتم.');

  await prisma.$disconnect();
})();

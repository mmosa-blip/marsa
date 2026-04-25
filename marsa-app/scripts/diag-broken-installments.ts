import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

(async () => {
  const broken = await prisma.contractPaymentInstallment.findMany({
    where: {
      isLocked: false,
      paymentStatus: 'UNPAID',
      order: { gt: 0 }
    },
    include: {
      contract: {
        select: {
          project: {
            select: { name: true, status: true, deletedAt: true }
          }
        }
      }
    }
  });

  console.log('أقساط تحتاج إغلاق (RAW count):', broken.length);

  const livingProjectsBroken = broken.filter(i => {
    const p = i.contract?.project;
    return p && !p.deletedAt;
  });
  console.log('  منهم في مشاريع غير محذوفة:', livingProjectsBroken.length);

  console.log('\nالتفاصيل (المشاريع غير المحذوفة فقط):');
  livingProjectsBroken.forEach(i => {
    const p = i.contract!.project!;
    console.log(`- [${p.status}] ${p.name} | order:${i.order} | ${i.title} | amount:${i.amount} | linked:${!!i.linkedTaskId}`);
  });

  if (broken.length > livingProjectsBroken.length) {
    console.log('\nأقساط في مشاريع محذوفة (لن تُعرض، لكن updateMany سيلمسها):');
    broken.filter(i => i.contract?.project?.deletedAt || !i.contract?.project).forEach(i => {
      const p = i.contract?.project;
      console.log(`- ${p ? '[deleted] ' + p.name : '[no project linked]'} | order:${i.order} | ${i.title}`);
    });
  }

  await prisma.$disconnect();
})().catch(async (e) => {
  console.error('FATAL:', e);
  await prisma.$disconnect();
  process.exit(1);
});

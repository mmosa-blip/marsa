import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

(async () => {
  const linked = await prisma.contractPaymentInstallment.count({
    where: { linkedTaskId: { not: null } }
  });

  const locked = await prisma.contractPaymentInstallment.count({
    where: { linkedTaskId: { not: null }, isLocked: true }
  });

  const unlockedUnpaid = await prisma.contractPaymentInstallment.count({
    where: {
      linkedTaskId: { not: null },
      isLocked: false,
      paymentStatus: 'UNPAID'
    }
  });

  const totalInstallments = await prisma.contractPaymentInstallment.count();
  const totalUnpaidLinked = await prisma.contractPaymentInstallment.count({
    where: { linkedTaskId: { not: null }, paymentStatus: 'UNPAID' }
  });

  console.log('إجمالي الأقساط في النظام:', totalInstallments);
  console.log('أقساط مربوطة بمهام:', linked);
  console.log('  منهم مقفلة (isLocked=true):', locked);
  console.log('  منهم غير مدفوعة:', totalUnpaidLinked);
  console.log('  منهم مفتوحة + غير مدفوعة (الفئة المشكوك بها):', unlockedUnpaid);

  const projects = await prisma.project.findMany({
    where: { deletedAt: null, status: 'ACTIVE' },
    take: 10,
    select: {
      id: true, name: true,
      contract: {
        select: {
          installments: {
            orderBy: { order: 'asc' },
            select: {
              order: true,
              title: true,
              isLocked: true,
              paymentStatus: true,
              linkedTaskId: true,
              amount: true,
              paidAmount: true,
            }
          }
        }
      }
    }
  });

  console.log('\n=== المشاريع النشطة (عينة 10) ===');
  for (const p of projects) {
    if (!p.contract?.installments?.length) {
      console.log(`\n[${p.name}]: لا أقساط في العقد`);
      continue;
    }
    console.log(`\n[${p.name}]`);
    p.contract.installments.forEach(i => {
      console.log(`  قسط ${i.order} (${i.title}): ${i.paymentStatus} | locked=${i.isLocked} | linked=${!!i.linkedTaskId} | ${i.paidAmount}/${i.amount}`);
    });
  }

  await prisma.$disconnect();
})().catch(async (e) => {
  console.error('FATAL:', e);
  await prisma.$disconnect();
  process.exit(1);
});

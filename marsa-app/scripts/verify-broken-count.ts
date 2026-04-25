import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
(async () => {
  const broken = await prisma.contractPaymentInstallment.count({
    where: { isLocked: false, paymentStatus: 'UNPAID', order: { gt: 0 } }
  });
  console.log('Remaining broken installments:', broken);
  await prisma.$disconnect();
})();

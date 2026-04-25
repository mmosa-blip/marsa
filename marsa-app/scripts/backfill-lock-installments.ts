import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import * as fs from 'fs';
import * as path from 'path';

(async () => {
  const where = {
    isLocked: false,
    paymentStatus: 'UNPAID',
    order: { gt: 0 },
  };

  const backup = await prisma.contractPaymentInstallment.findMany({ where });
  console.log('Rows matching backfill criteria:', backup.length);

  if (backup.length === 0) {
    console.log('Nothing to backfill. Exiting without writing backup.');
    await prisma.$disconnect();
    return;
  }

  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupDir = path.join(process.cwd(), 'backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const backupFile = path.join(backupDir, `installments-pre-lock-${ts}.json`);
  fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));
  console.log('Backup written:', backupFile);

  const result = await prisma.contractPaymentInstallment.updateMany({
    where,
    data: { isLocked: true },
  });
  console.log('Locked:', result.count, 'installment(s)');

  await prisma.$disconnect();
})().catch(async (e) => {
  console.error('FATAL:', e);
  await prisma.$disconnect();
  process.exit(1);
});

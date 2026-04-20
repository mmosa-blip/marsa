import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

(async () => {
  const u = await prisma.user.findFirst({
    where: { phone: '+966501234567' },
    select: { name: true, phone: true, role: true, mustChangePassword: true, createdAt: true },
  });
  console.log('DB user:', u);
  await prisma.$disconnect();
})();

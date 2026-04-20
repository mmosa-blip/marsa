import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

(async () => {
  // Soft-delete only the just-created SecTest2. +966500000000 belongs to
  // a pre-existing user with contracts — leave alone.
  const result = await prisma.user.updateMany({
    where: { phone: '+966501234567' },
    data: { deletedAt: new Date(), isActive: false },
  });
  console.log('Soft-deleted SecTest2:', result.count);
  await prisma.$disconnect();
})();

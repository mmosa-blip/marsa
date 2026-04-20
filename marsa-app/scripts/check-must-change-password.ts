import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

(async () => {
  try {
    const rows = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'mustChangePassword'`
    );
    console.log('Column exists?', rows.length > 0 ? 'YES' : 'NO');
    if (rows.length === 0) {
      const rows2 = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'mustChangePassword'`
      );
      console.log('In lowercase users?', rows2.length > 0 ? 'YES' : 'NO');
    }
  } catch (e) {
    console.error(e);
  }
  await prisma.$disconnect();
})();

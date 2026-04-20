import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

(async () => {
  try {
    // Find the actual table name
    const tables = await prisma.$queryRawUnsafe<{ table_name: string }[]>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name ILIKE '%user%'`
    );
    console.log('User-related tables:', tables);

    const userTable = tables.find(t => t.table_name.toLowerCase() === 'users')?.table_name
      || tables.find(t => t.table_name.toLowerCase() === 'user')?.table_name;

    if (!userTable) {
      console.log('No users table found!');
      await prisma.$disconnect();
      return;
    }
    console.log('Target table:', userTable);

    // Check if column already exists
    const existing = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name = 'mustChangePassword'`,
      userTable
    );
    if (existing.length > 0) {
      console.log('Column already exists — skipping ALTER.');
      await prisma.$disconnect();
      return;
    }

    console.log('Adding column mustChangePassword...');
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "${userTable}" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false`
    );
    console.log('Column added.');
  } catch (e) {
    console.error('ERROR:', e);
    process.exit(1);
  }
  await prisma.$disconnect();
})();

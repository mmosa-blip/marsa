import { createScriptPrisma } from "./db";

async function main() {
  const prisma = createScriptPrisma();

  // Use raw query since the generated client now expects phone as non-null
  const nullUsers: { id: string; name: string; email: string | null }[] =
    await prisma.$queryRaw`SELECT id, name, email FROM users WHERE phone IS NULL OR phone = ''`;

  console.log(`Found ${nullUsers.length} users with null/empty phone:`);
  for (const u of nullUsers) {
    console.log(`  - ${u.name} (${u.email || "no email"})`);
  }

  if (nullUsers.length === 0) {
    console.log("No fix needed.");
    await prisma.$disconnect();
    return;
  }

  // Assign temporary unique phone numbers
  for (let i = 0; i < nullUsers.length; i++) {
    const tempPhone = `050000000${i + 1}`;
    await prisma.$executeRaw`UPDATE users SET phone = ${tempPhone} WHERE id = ${nullUsers[i].id}`;
    console.log(`  ✓ ${nullUsers[i].name} → ${tempPhone}`);
  }

  console.log("Done. Update these to real phone numbers later.");
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });

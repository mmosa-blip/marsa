import { createScriptPrisma } from "./db";
import bcrypt from "bcryptjs";

async function main() {
  const prisma = createScriptPrisma();

  console.log("=== Testing Supabase connection ===");

  // Test 1: Connection
  try {
    const count = await prisma.user.count();
    console.log(`✓ Connection OK. Users in DB: ${count}`);
  } catch (e) {
    console.error("✗ Connection failed:", e instanceof Error ? e.message : e);
    return;
  }

  // Test 2: Attempt to create a test user
  console.log("\n=== Testing user creation ===");
  const testPhone = "0511112222";

  try {
    // Check if test user exists
    const existing = await prisma.user.findUnique({ where: { phone: testPhone } });
    if (existing) {
      console.log(`Test user exists, deleting...`);
      await prisma.user.delete({ where: { id: existing.id } });
    }

    const hashedPassword = await bcrypt.hash("Test@12345", 12);
    const user = await prisma.user.create({
      data: {
        phone: testPhone,
        password: hashedPassword,
        name: "Test User",
        email: null,
        role: "CLIENT",
      },
    });
    console.log(`✓ User created: ${user.id} / ${user.phone}`);

    // Clean up
    await prisma.user.delete({ where: { id: user.id } });
    console.log(`✓ Cleanup done`);
  } catch (e) {
    console.error("✗ User creation failed:");
    console.error(e);
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });

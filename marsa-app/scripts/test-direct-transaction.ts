/**
 * Verifies that the direct-connection Prisma client supports
 * interactive $transaction callbacks.
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

async function test() {
  const directUrl = process.env.DIRECT_URL;
  if (!directUrl) {
    console.log("DIRECT_URL not set — skipping.");
    process.exit(1);
  }

  console.log("Testing $transaction on direct connection (port 5432)...\n");

  const adapter = new PrismaPg({ connectionString: directUrl });
  const client = new PrismaClient({ adapter });

  // Test 1: simple $transaction
  try {
    const result = await client.$transaction(async (tx) => {
      const count = await tx.user.count();
      return count;
    });
    console.log("  Test 1: Simple $transaction — User count:", result);
  } catch (err) {
    console.log("  Test 1 FAILED:", (err as Error).message);
    await client.$disconnect();
    process.exit(1);
  }

  // Test 2: rollback on error
  try {
    await client.$transaction(async (tx) => {
      await tx.user.count();
      throw new Error("Intentional error for rollback test");
    });
    console.log("  Test 2 FAILED: transaction did not throw");
  } catch (err) {
    if ((err as Error).message.includes("Intentional")) {
      console.log("  Test 2: Rollback on error — OK");
    } else {
      console.log("  Test 2 FAILED: unexpected error:", (err as Error).message);
    }
  }

  await client.$disconnect();
  console.log("\nAll tests passed. prismaDirect is ready to use.");
}

test();

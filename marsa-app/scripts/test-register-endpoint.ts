/**
 * Simulates the register endpoint end-to-end against the current DATABASE_URL.
 */
import { createScriptPrisma } from "./db";
import bcrypt from "bcryptjs";
import { passwordSchema, normalizeSaudiPhone, isValidSaudiPhone } from "../src/lib/validations";

async function register(body: { name: string; phone: string; password: string; email?: string; role?: string }) {
  const prisma = createScriptPrisma();
  const { password, name, phone, email, role } = body;

  if (!name) return { status: 400, error: "الاسم مطلوب" };
  if (!phone) return { status: 400, error: "رقم الجوال مطلوب" };

  const normalizedPhone = normalizeSaudiPhone(phone);
  if (!isValidSaudiPhone(normalizedPhone)) {
    return { status: 400, error: "رقم الجوال غير صحيح" };
  }

  const passwordResult = passwordSchema.safeParse(password);
  if (!passwordResult.success) {
    return { status: 400, error: passwordResult.error.issues.map((e) => e.message).join(", ") };
  }

  try {
    const existingUser = await prisma.user.findUnique({ where: { phone: normalizedPhone } });
    if (existingUser) return { status: 409, error: "رقم الجوال مسجل مسبقاً" };

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        phone: normalizedPhone,
        password: hashedPassword,
        name,
        email: email?.trim() || null,
        role: role || "CLIENT",
      },
      select: { id: true, phone: true, name: true, role: true, createdAt: true },
    });

    // Clean up
    await prisma.user.delete({ where: { id: user.id } });
    return { status: 201, user };
  } catch (error) {
    console.error("\n=== RAW ERROR ===");
    console.error(error);
    return { status: 500, error: error instanceof Error ? error.message : "unknown" };
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  console.log("Test 1: Valid new user");
  console.log(await register({
    name: "Test User",
    phone: "0599887766",
    password: "Test@12345",
  }));

  console.log("\nTest 2: With email");
  console.log(await register({
    name: "Test User 2",
    phone: "0599887767",
    password: "Test@12345",
    email: "test@example.com",
  }));

  console.log("\nTest 3: Duplicate phone (should fail)");
  console.log(await register({
    name: "Admin Duplicate",
    phone: "0500000000",
    password: "Test@12345",
  }));
}

main().catch(console.error);

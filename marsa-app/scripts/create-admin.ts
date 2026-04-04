import { createScriptPrisma } from "./db";
import bcrypt from "bcryptjs";

async function main() {
  const prisma = createScriptPrisma();

  const hash = await bcrypt.hash("Marsa@Admin2026!", 12);

  // Try to find existing admin by email or phone
  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        { email: "m.mosa@bmarsa.com" },
        { phone: "0500000000" },
      ],
    },
  });

  if (existing) {
    // Update existing admin with phone if missing
    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: {
        phone: "0500000000",
        email: "m.mosa@bmarsa.com",
        password: hash,
        role: "ADMIN",
      },
    });
    console.log("Admin user updated:", updated.id, updated.phone, updated.role);
  } else {
    const user = await prisma.user.create({
      data: {
        phone: "0500000000",
        email: "m.mosa@bmarsa.com",
        password: hash,
        name: "Mohammed Mosa",
        role: "ADMIN",
      },
    });
    console.log("Admin user created:", user.id, user.phone, user.role);
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });

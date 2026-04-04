import { createScriptPrisma } from "./db";
import bcrypt from "bcryptjs";

async function main() {
  const prisma = createScriptPrisma();

  const hash = await bcrypt.hash("Marsa@Admin2026!", 12);

  const user = await prisma.user.create({
    data: {
      email: "m.mosa@bmarsa.com",
      password: hash,
      name: "Mohammed Mosa",
      role: "ADMIN",
    },
  });

  console.log("Admin user created:", user.id, user.email, user.role);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import bcrypt from "bcryptjs";

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL is required");

  const url = new URL(dbUrl.replace("mysql://", "http://"));
  const adapter = new PrismaMariaDb({
    host: url.hostname,
    port: parseInt(url.port || "3306"),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1).split("?")[0],
  });
  const prisma = new PrismaClient({ adapter });

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

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

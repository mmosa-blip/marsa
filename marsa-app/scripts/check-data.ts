import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL required");
  const url = new URL(dbUrl.replace("mysql://", "http://"));
  const adapter = new PrismaMariaDb({
    host: url.hostname,
    port: parseInt(url.port || "3306"),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1).split("?")[0],
  });
  const prisma = new PrismaClient({ adapter });

  console.log("=== PRODUCTION DATA STATUS ===");
  console.log("Users:", await prisma.user.count());
  console.log("Projects:", await prisma.project.count());
  console.log("Tasks:", await prisma.task.count());
  console.log("Services:", await prisma.service.count());
  console.log("Invoices:", await prisma.invoice.count());
  console.log("Contracts:", await prisma.contract.count());
  console.log("Companies:", await prisma.company.count());

  const admin = await prisma.user.findUnique({
    where: { email: "m.mosa@bmarsa.com" },
    select: { id: true, name: true, role: true, isActive: true, deletedAt: true },
  });
  console.log("Admin user:", JSON.stringify(admin, null, 2));

  await prisma.$disconnect();
}
main().catch(console.error);

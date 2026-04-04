import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

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
    ...(process.env.DATABASE_SSL === "true" ? { ssl: true } : {}),
  });
  const prisma = new PrismaClient({ adapter });

  const departments = [
    { name: "قسم الاستثمار", nameEn: "Investment", color: "#5E5495" },
    { name: "قسم الإقامة المميزة", nameEn: "Premium Residency", color: "#C9A84C" },
    { name: "قسم العقار", nameEn: "Real Estate", color: "#059669" },
    { name: "قسم الخدمات", nameEn: "Services", color: "#EA580C" },
  ];

  for (const dept of departments) {
    await prisma.department.upsert({
      where: { name: dept.name },
      update: { nameEn: dept.nameEn, color: dept.color },
      create: dept,
    });
    console.log(`✓ ${dept.name} (${dept.nameEn})`);
  }

  console.log("Done seeding departments.");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

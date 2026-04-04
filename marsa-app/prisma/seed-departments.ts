import "dotenv/config";
import { createScriptPrisma } from "../scripts/db";

async function main() {
  const prisma = createScriptPrisma();

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

main().catch((e) => { console.error(e); process.exit(1); });

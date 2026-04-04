import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const dbUrl = new URL(process.env.DATABASE_URL!.replace("mysql://", "http://"));
const adapter = new PrismaMariaDb({
  host: dbUrl.hostname,
  port: parseInt(dbUrl.port || "4000"),
  user: decodeURIComponent(dbUrl.username),
  password: decodeURIComponent(dbUrl.password),
  database: dbUrl.pathname.slice(1),
  ssl: true,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  // العملاء الثلاثة الموجودين
  const clients = await prisma.user.findMany({
    where: { role: "CLIENT", email: { in: ["ahmed@almansouri.com", "sara@alotaibi-design.com", "khalid@aldosari-group.com"] } },
    include: { ownedCompanies: true },
  });

  if (clients.length === 0) {
    console.log("لم يتم العثور على العملاء — يرجى تشغيل seed-clients.ts أولاً");
    return;
  }

  const ahmed = clients.find((c) => c.email === "ahmed@almansouri.com");
  const sara = clients.find((c) => c.email === "sara@alotaibi-design.com");
  const khalid = clients.find((c) => c.email === "khalid@aldosari-group.com");

  // ===== تحديث نوع التفويض =====
  if (ahmed) {
    await prisma.user.update({
      where: { id: ahmed.id },
      data: { authorizationType: "FULL", authorizationGrantedAt: new Date("2026-01-15") },
    });
    console.log("✅ أحمد المنصوري → تفويض شامل (FULL)");
  }

  if (sara) {
    await prisma.user.update({
      where: { id: sara.id },
      data: { authorizationType: "PER_SERVICE", authorizationGrantedAt: new Date("2026-02-01") },
    });
    console.log("✅ سارة العتيبي → تفويض لكل خدمة (PER_SERVICE)");
  }

  if (khalid) {
    await prisma.user.update({
      where: { id: khalid.id },
      data: { authorizationType: "NONE", authorizationGrantedAt: null },
    });
    console.log("✅ خالد الدوسري → بدون تفويض (NONE)");
  }

  // ===== إضافة موظفين لشركات العملاء =====
  for (const client of [ahmed, sara, khalid]) {
    if (!client || client.ownedCompanies.length === 0) continue;
    const companyId = client.ownedCompanies[0].id;

    // تحقق من وجود موظفين مسبقاً
    const existingCount = await prisma.employee.count({ where: { companyId } });
    if (existingCount > 0) continue;

    await prisma.employee.createMany({
      data: [
        {
          name: `محمد (${client.name.split(" ")[0]})`,
          jobTitle: "مدير عمليات",
          department: "الإدارة",
          phone: "+966501111111",
          status: "ACTIVE",
          nationality: "سعودي",
          hireDate: new Date("2024-06-01"),
          residencyExpiry: new Date("2027-06-01"),
          companyId,
        },
        {
          name: `فاطمة (${client.name.split(" ")[0]})`,
          jobTitle: "محاسبة",
          department: "المالية",
          phone: "+966502222222",
          status: "ACTIVE",
          nationality: "سعودية",
          hireDate: new Date("2025-01-15"),
          residencyExpiry: new Date("2027-01-15"),
          companyId,
        },
        {
          name: `عبدالله (${client.name.split(" ")[0]})`,
          jobTitle: "مطور",
          department: "التقنية",
          phone: "+966503333333",
          status: "ACTIVE",
          nationality: "أردني",
          hireDate: new Date("2025-03-01"),
          residencyExpiry: new Date("2026-04-10"),
          companyId,
        },
      ],
    });
    console.log(`✅ تم إنشاء 3 موظفين لشركة ${client.ownedCompanies[0].name}`);
  }

  // ===== إضافة الوثائق =====
  const now = new Date();

  for (const client of [ahmed, sara, khalid]) {
    if (!client) continue;
    const companyId = client.ownedCompanies[0]?.id || null;

    // تحقق من وجود وثائق مسبقاً
    const existingDocs = await prisma.document.count({ where: { ownerId: client.id } });
    if (existingDocs > 0) {
      console.log(`⏭️ وثائق ${client.name} موجودة مسبقاً — تخطي`);
      continue;
    }

    const docs = [
      {
        title: `سجل تجاري - ${client.ownedCompanies[0]?.name || client.name}`,
        type: "COMMERCIAL_REGISTER" as const,
        documentNumber: `CR-${Math.floor(1000000 + Math.random() * 9000000)}`,
        issueDate: new Date("2024-01-15"),
        expiryDate: new Date("2027-01-15"), // ساري
        status: "VALID" as const,
        reminderDays: 60,
        isLinkedToCompany: true,
      },
      {
        title: `رخصة بلدية - ${client.ownedCompanies[0]?.name || client.name}`,
        type: "MUNICIPAL_LICENSE" as const,
        documentNumber: `ML-${Math.floor(10000 + Math.random() * 90000)}`,
        issueDate: new Date("2025-04-01"),
        expiryDate: new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000), // تنتهي خلال 20 يوم
        status: "EXPIRING_SOON" as const,
        reminderDays: 30,
        isLinkedToCompany: true,
      },
      {
        title: `شهادة الزكاة والدخل`,
        type: "ZAKAT_CERTIFICATE" as const,
        documentNumber: `ZK-${Math.floor(100000 + Math.random() * 900000)}`,
        issueDate: new Date("2024-06-01"),
        expiryDate: new Date("2025-06-01"), // منتهية
        status: "EXPIRED" as const,
        reminderDays: 30,
        isLinkedToCompany: true,
      },
      {
        title: `عقد إيجار المقر الرئيسي`,
        type: "LEASE_CONTRACT" as const,
        documentNumber: `LC-${Math.floor(1000 + Math.random() * 9000)}`,
        issueDate: new Date("2025-01-01"),
        expiryDate: new Date("2028-01-01"), // ساري
        status: "VALID" as const,
        reminderDays: 90,
        isLinkedToCompany: false,
      },
      {
        title: `ترخيص نشاط إضافي`,
        type: "CUSTOM" as const,
        customTypeName: "ترخيص نشاط تجارة إلكترونية",
        documentNumber: `CUS-${Math.floor(100 + Math.random() * 900)}`,
        issueDate: new Date("2025-06-01"),
        expiryDate: new Date("2027-06-01"), // ساري
        status: "VALID" as const,
        reminderDays: 30,
        isLinkedToCompany: false,
      },
    ];

    for (const doc of docs) {
      await prisma.document.create({
        data: {
          ...doc,
          ownerId: client.id,
          companyId,
        },
      });
    }

    console.log(`✅ تم إنشاء 5 وثائق لـ ${client.name}`);
  }

  console.log("\n🎉 تم تحديث جميع العملاء بالتفويضات والوثائق والموظفين!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => { prisma.$disconnect(); });

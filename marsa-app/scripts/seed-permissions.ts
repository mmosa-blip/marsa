import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

function createPrismaClient() {
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
  return new PrismaClient({ adapter });
}

const prisma = createPrismaClient();

const permissions = [
  { key: "projects.view", label: "عرض المشاريع", module: "المشاريع" },
  { key: "projects.create", label: "إنشاء مشروع", module: "المشاريع" },
  { key: "projects.edit", label: "تعديل المشروع", module: "المشاريع" },
  { key: "projects.delete", label: "حذف المشروع", module: "المشاريع" },
  { key: "tasks.view", label: "عرض المهام", module: "المهام" },
  { key: "tasks.update_status", label: "تحديث حالة المهمة", module: "المهام" },
  { key: "tasks.transfer", label: "تحويل المهام", module: "المهام" },
  { key: "tasks.assign", label: "إسناد المهام", module: "المهام" },
  { key: "contracts.view", label: "عرض العقود", module: "العقود" },
  { key: "contracts.create", label: "إنشاء عقد", module: "العقود" },
  { key: "contracts.approve", label: "اعتماد العقد", module: "العقود" },
  { key: "contracts.delete", label: "حذف العقد", module: "العقود" },
  { key: "contracts.templates", label: "إدارة قوالب العقود", module: "العقود" },
  { key: "clients.view", label: "عرض العملاء", module: "العملاء" },
  { key: "clients.create", label: "إضافة عميل", module: "العملاء" },
  { key: "clients.edit", label: "تعديل بيانات العميل", module: "العملاء" },
  { key: "clients.delete", label: "حذف عميل", module: "العملاء" },
  { key: "finance.view", label: "عرض الإدارة المالية", module: "المالية" },
  { key: "finance.cashier", label: "الوصول للكاشير", module: "المالية" },
  { key: "finance.installments", label: "إدارة الدفعات", module: "المالية" },
  { key: "finance.approve", label: "اعتماد المدفوعات", module: "المالية" },
  { key: "finance.expenses", label: "طلبات الصرف", module: "المالية" },
  { key: "users.view", label: "عرض المستخدمين", module: "المستخدمون" },
  { key: "users.create", label: "إضافة مستخدم", module: "المستخدمون" },
  { key: "users.edit", label: "تعديل مستخدم", module: "المستخدمون" },
  { key: "users.delete", label: "حذف مستخدم", module: "المستخدمون" },
  { key: "users.permissions", label: "إدارة الصلاحيات", module: "المستخدمون" },
  { key: "tickets.view", label: "عرض التذاكر", module: "الدعم" },
  { key: "tickets.manage", label: "إدارة التذاكر", module: "الدعم" },
  { key: "tickets.assign", label: "إسناد التذاكر", module: "الدعم" },
  { key: "reports.view", label: "عرض التقارير", module: "التقارير" },
  { key: "reports.time", label: "تقارير الوقت", module: "التقارير" },
  { key: "reports.financial", label: "التقارير المالية", module: "التقارير" },
  { key: "settings.view", label: "عرض الإعدادات", module: "الإعدادات" },
  { key: "settings.edit", label: "تعديل الإعدادات", module: "الإعدادات" },
];

async function main() {
  console.log("Seeding permissions...");
  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { key: perm.key },
      update: { label: perm.label, module: perm.module },
      create: perm,
    });
  }
  console.log(`✓ Seeded ${permissions.length} permissions.`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });

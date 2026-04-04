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
  console.log("جارٍ إضافة بيانات التذكيرات...");

  const admin = await prisma.user.findUnique({ where: { email: "admin@marsa.sa" } });
  if (!admin) { console.error("يجب تشغيل seed-projects.ts أولاً"); process.exit(1); }

  const company = await prisma.company.findFirst({ where: { ownerId: admin.id } });
  if (!company) { console.error("لا توجد شركة"); process.exit(1); }

  const employees = await prisma.employee.findMany({ where: { companyId: company.id }, take: 5 });

  const now = new Date();
  const addDays = (d: number) => new Date(now.getTime() + d * 86400000);

  const reminders = [
    {
      title: "تجديد إقامة راجيش كومار",
      description: "إقامة الموظف راجيش كومار تنتهي قريباً ويجب تجديدها",
      type: "RESIDENCY_EXPIRY" as const,
      dueDate: addDays(15),
      status: "PENDING" as const,
      reminderDays: 30,
      priority: "HIGH" as const,
      employeeId: employees.find((e) => e.name.includes("راجيش"))?.id || null,
    },
    {
      title: "تجديد تأمين خالد الحربي",
      description: "التأمين الطبي للموظف خالد الحربي ينتهي قريباً",
      type: "INSURANCE_EXPIRY" as const,
      dueDate: addDays(45),
      status: "PENDING" as const,
      reminderDays: 30,
      priority: "MEDIUM" as const,
      employeeId: employees.find((e) => e.name.includes("خالد"))?.id || null,
    },
    {
      title: "تجديد الرخصة التجارية",
      description: "الرخصة التجارية لشركة الابتكار للتقنية تنتهي ويجب تجديدها",
      type: "LICENSE_EXPIRY" as const,
      dueDate: addDays(5),
      status: "NOTIFIED" as const,
      reminderDays: 60,
      priority: "CRITICAL" as const,
      isRecurring: true,
      recurringMonths: 12,
      employeeId: null,
    },
    {
      title: "تجديد عقد استضافة السيرفرات",
      description: "عقد الاستضافة السنوي مع مزود الخدمة ينتهي قريباً",
      type: "CONTRACT_RENEWAL" as const,
      dueDate: addDays(25),
      status: "PENDING" as const,
      reminderDays: 30,
      priority: "MEDIUM" as const,
      isRecurring: true,
      recurringMonths: 12,
      employeeId: null,
    },
    {
      title: "تجديد تأمين نورة العمري",
      description: "التأمين الطبي ينتهي ويحتاج تجديد",
      type: "INSURANCE_EXPIRY" as const,
      dueDate: addDays(-3),
      status: "OVERDUE" as const,
      reminderDays: 14,
      priority: "HIGH" as const,
      employeeId: employees.find((e) => e.name.includes("نورة"))?.id || null,
    },
    {
      title: "تجديد إقامة موظف جديد",
      description: "إقامة بحاجة لتجديد خلال 90 يوم",
      type: "RESIDENCY_EXPIRY" as const,
      dueDate: addDays(85),
      status: "PENDING" as const,
      reminderDays: 90,
      priority: "LOW" as const,
      employeeId: null,
    },
    {
      title: "تجديد شهادة الزكاة والدخل",
      description: "الشهادة السنوية بحاجة لتجديد",
      type: "LICENSE_EXPIRY" as const,
      dueDate: addDays(10),
      status: "PENDING" as const,
      reminderDays: 30,
      priority: "HIGH" as const,
      isRecurring: true,
      recurringMonths: 12,
      employeeId: null,
    },
    {
      title: "اجتماع مراجعة العقود الفصلية",
      description: "مراجعة دورية لجميع العقود والاتفاقيات",
      type: "CUSTOM" as const,
      dueDate: addDays(20),
      status: "COMPLETED" as const,
      reminderDays: 7,
      priority: "MEDIUM" as const,
      isRecurring: true,
      recurringMonths: 3,
      employeeId: null,
    },
  ];

  for (const r of reminders) {
    await prisma.reminder.create({
      data: {
        ...r,
        companyId: company.id,
        createdById: admin.id,
      },
    });
  }

  console.log(`تم إنشاء ${reminders.length} تذكيرات بنجاح!`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });

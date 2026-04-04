import "dotenv/config";
import { PrismaClient, TaskStatus, TaskPriority } from "../src/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import bcrypt from "bcryptjs";

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
  console.log("جارٍ إضافة بيانات المشاريع التجريبية...");

  // إنشاء مستخدمين تجريبيين
  const hashedPassword = await bcrypt.hash("12345678", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@marsa.sa" },
    update: {},
    create: {
      email: "admin@marsa.sa",
      password: hashedPassword,
      name: "عبدالله المرسى",
      role: "ADMIN",
      phone: "0501234567",
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: "manager@marsa.sa" },
    update: {},
    create: {
      email: "manager@marsa.sa",
      password: hashedPassword,
      name: "سارة القحطاني",
      role: "MANAGER",
      phone: "0559876543",
    },
  });

  const client = await prisma.user.upsert({
    where: { email: "client@marsa.sa" },
    update: {},
    create: {
      email: "client@marsa.sa",
      password: hashedPassword,
      name: "محمد العتيبي",
      role: "CLIENT",
      phone: "0541112233",
    },
  });

  const executor = await prisma.user.upsert({
    where: { email: "executor@marsa.sa" },
    update: {},
    create: {
      email: "executor@marsa.sa",
      password: hashedPassword,
      name: "فهد الشمري",
      role: "EXECUTOR",
      phone: "0534445566",
    },
  });

  console.log("تم إنشاء المستخدمين");

  // جلب الخدمات
  const services = await prisma.service.findMany();
  const svcMap: Record<string, string> = {};
  services.forEach((s) => { svcMap[s.name] = s.id; });

  // إنشاء مشروع
  const project = await prisma.project.create({
    data: {
      name: "تأسيس شركة الابتكار للتقنية",
      clientId: client.id,
      managerId: manager.id,
      status: "ACTIVE",
      priority: "HIGH",
      startDate: new Date("2026-03-01"),
      endDate: new Date("2026-05-30"),
    },
  });

  console.log("تم إنشاء المشروع");

  // إنشاء 8 مهام تحت 3 خدمات
  const tasks = [
    // خدمة: تأسيس الشركات
    {
      title: "إعداد عقد التأسيس والنظام الأساسي",
      serviceId: svcMap["تأسيس الشركات"],
      assigneeId: executor.id,
      status: "DONE",
      priority: "HIGH",
      order: 0,
      dueDate: new Date("2026-03-10"),
    },
    {
      title: "التسجيل في السجل التجاري",
      serviceId: svcMap["تأسيس الشركات"],
      assigneeId: executor.id,
      status: "DONE",
      priority: "HIGH",
      order: 1,
      dueDate: new Date("2026-03-15"),
    },
    {
      title: "فتح حساب بنكي للشركة",
      serviceId: svcMap["تأسيس الشركات"],
      assigneeId: executor.id,
      status: "IN_PROGRESS",
      priority: "MEDIUM",
      order: 2,
      dueDate: new Date("2026-03-25"),
    },
    // خدمة: استخراج التراخيص
    {
      title: "استخراج رخصة النشاط التجاري",
      serviceId: svcMap["استخراج التراخيص"],
      assigneeId: executor.id,
      status: "IN_PROGRESS",
      priority: "HIGH",
      order: 3,
      dueDate: new Date("2026-04-01"),
    },
    {
      title: "التسجيل في الضريبة المضافة",
      serviceId: svcMap["استخراج التراخيص"],
      assigneeId: null,
      status: "TODO",
      priority: "MEDIUM",
      order: 4,
      dueDate: new Date("2026-04-10"),
    },
    {
      title: "استخراج شهادة الزكاة والدخل",
      serviceId: svcMap["استخراج التراخيص"],
      assigneeId: null,
      status: "IN_REVIEW",
      priority: "MEDIUM",
      order: 5,
      dueDate: new Date("2026-04-15"),
    },
    // خدمة: الاستشارات القانونية
    {
      title: "مراجعة العقود والاتفاقيات",
      serviceId: svcMap["الاستشارات القانونية"],
      assigneeId: manager.id,
      status: "TODO",
      priority: "URGENT",
      order: 6,
      dueDate: new Date("2026-04-20"),
    },
    {
      title: "إعداد سياسة حماية البيانات",
      serviceId: svcMap["الاستشارات القانونية"],
      assigneeId: null,
      status: "TODO",
      priority: "LOW",
      order: 7,
      dueDate: new Date("2026-05-01"),
    },
  ];

  for (const task of tasks) {
    await prisma.task.create({
      data: { ...task, status: task.status as TaskStatus, priority: task.priority as TaskPriority, projectId: project.id },
    });
  }

  console.log(`تم إنشاء ${tasks.length} مهام`);

  console.log("\n=== بيانات تسجيل الدخول ===");
  console.log("المدير:  admin@marsa.sa / 12345678");
  console.log("المشرف:  manager@marsa.sa / 12345678");
  console.log("العميل:  client@marsa.sa / 12345678");
  console.log("المنفذ:  executor@marsa.sa / 12345678");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });

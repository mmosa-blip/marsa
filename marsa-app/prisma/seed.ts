import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
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
  console.log("🚀 بدء إنشاء البيانات التجريبية الشاملة...\n");

  const hash = await bcrypt.hash("12345678", 12);
  const now = new Date();
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000);
  const daysLater = (d: number) => new Date(now.getTime() + d * 86400000);

  // =============================
  // أ. المستخدمون
  // =============================
  console.log("👤 إنشاء المستخدمين...");

  const admin = await prisma.user.create({
    data: { email: "admin@marsa.sa", password: hash, name: "أحمد المدير", role: "ADMIN", phone: "0500000001" },
  });

  const manager = await prisma.user.create({
    data: { email: "manager@marsa.sa", password: hash, name: "خالد المشرف", role: "MANAGER", phone: "0500000002" },
  });

  const financeManager = await prisma.user.create({
    data: { email: "finance@marsa.sa", password: hash, name: "سعد المالي", role: "FINANCE_MANAGER", phone: "0500000003" },
  });

  const treasuryManager = await prisma.user.create({
    data: { email: "treasury@marsa.sa", password: hash, name: "فهد أمين الصندوق", role: "TREASURY_MANAGER", phone: "0500000004" },
  });

  const exec1 = await prisma.user.create({
    data: { email: "exec1@marsa.sa", password: hash, name: "محمد المنفذ", role: "EXECUTOR", phone: "0500000005" },
  });

  const exec2 = await prisma.user.create({
    data: { email: "exec2@marsa.sa", password: hash, name: "عبدالله المنفذ", role: "EXECUTOR", phone: "0500000006" },
  });

  // 3 عملاء
  const client1 = await prisma.user.create({
    data: { email: "client1@marsa.sa", password: hash, name: "عبدالرحمن العميل", role: "CLIENT", phone: "0511111111", authorizationType: "FULL", authorizationGrantedAt: new Date() },
  });

  const client2 = await prisma.user.create({
    data: { email: "client2@marsa.sa", password: hash, name: "فيصل التاجر", role: "CLIENT", phone: "0522222222", authorizationType: "PER_SERVICE" },
  });

  const client3 = await prisma.user.create({
    data: { email: "client3@marsa.sa", password: hash, name: "سلطان رجل الأعمال", role: "CLIENT", phone: "0533333333", authorizationType: "NONE" },
  });

  // 3 مقدمي خدمات خارجيين
  const provider1 = await prisma.user.create({
    data: {
      email: "provider1@marsa.sa", password: hash, name: "ياسر المحاسب", role: "EXTERNAL_PROVIDER",
      phone: "0551234567", isExternal: true, specialization: "محاسب",
      costPerTask: 200, bankName: "البنك الأهلي", bankIban: "SA1234567890123456789012", supervisorId: exec1.id,
    },
  });

  const provider2 = await prisma.user.create({
    data: {
      email: "provider2@marsa.sa", password: hash, name: "نايف المحامي", role: "EXTERNAL_PROVIDER",
      phone: "0552345678", isExternal: true, specialization: "محامي",
      costPerTask: 350, bankName: "بنك الراجحي", bankIban: "SA9876543210987654321098", supervisorId: exec2.id,
    },
  });

  const provider3 = await prisma.user.create({
    data: {
      email: "provider3@marsa.sa", password: hash, name: "بدر المعقب", role: "EXTERNAL_PROVIDER",
      phone: "0553456789", isExternal: true, specialization: "معقب حكومي",
      costPerTask: 150, bankName: "بنك الإنماء", bankIban: "SA5555666677778888999900", supervisorId: exec1.id,
    },
  });

  console.log("  ✓ 12 مستخدم");

  // =============================
  // ب. الشركات
  // =============================
  console.log("🏢 إنشاء الشركات...");

  const companyMarsa = await prisma.company.create({
    data: { name: "شركة مرسى الأعمال", commercialRegister: "1010999999", sector: "خدمات أعمال", ownerId: admin.id },
  });

  const company1 = await prisma.company.create({
    data: { name: "مؤسسة النور", commercialRegister: "1010000001", sector: "تجارة", ownerId: client1.id },
  });

  const company2 = await prisma.company.create({
    data: { name: "شركة الفيصل", commercialRegister: "1010000002", sector: "مقاولات", ownerId: client2.id },
  });

  const company3 = await prisma.company.create({
    data: { name: "مجموعة سلطان", commercialRegister: "1010000003", sector: "تقنية", ownerId: client3.id },
  });

  console.log("  ✓ 4 شركات");

  // =============================
  // ج. فئات الخدمات
  // =============================
  console.log("📋 إنشاء كتالوج الخدمات...");

  const catGov = await prisma.serviceCategory.create({
    data: { name: "خدمات حكومية", description: "خدمات التعامل مع الجهات الحكومية", color: "#2563EB", icon: "Building2", sortOrder: 1 },
  });

  const catAcc = await prisma.serviceCategory.create({
    data: { name: "خدمات محاسبية", description: "خدمات المحاسبة والمالية", color: "#22C55E", icon: "Calculator", sortOrder: 2 },
  });

  const catHR = await prisma.serviceCategory.create({
    data: { name: "خدمات موارد بشرية", description: "خدمات إدارة الموارد البشرية", color: "#8B5CF6", icon: "Users", sortOrder: 3 },
  });

  const catLegal = await prisma.serviceCategory.create({
    data: { name: "خدمات قانونية", description: "الاستشارات والخدمات القانونية", color: "#EA580C", icon: "Scale", sortOrder: 4 },
  });

  // =============================
  // د. قوالب الخدمات (8 خدمات مع مهامها)
  // =============================

  // 1. إصدار/تجديد سجل تجاري
  const svcT1 = await prisma.serviceTemplate.create({
    data: {
      name: "إصدار/تجديد سجل تجاري", description: "إجراءات إصدار أو تجديد السجل التجاري",
      defaultPrice: 1500, defaultDuration: 5, workflowType: "SEQUENTIAL", categoryId: catGov.id, sortOrder: 1,
      taskTemplates: { create: [
        { name: "مراجعة المستندات", defaultDuration: 1, sortOrder: 1 },
        { name: "تقديم الطلب", defaultDuration: 1, sortOrder: 2 },
        { name: "متابعة", defaultDuration: 2, sortOrder: 3 },
        { name: "استلام وتسليم", defaultDuration: 1, sortOrder: 4 },
      ]},
    },
  });

  // 2. تجديد رخصة بلدية
  const svcT2 = await prisma.serviceTemplate.create({
    data: {
      name: "تجديد رخصة بلدية", description: "إجراءات تجديد الرخصة البلدية",
      defaultPrice: 2000, defaultDuration: 7, workflowType: "SEQUENTIAL", categoryId: catGov.id, sortOrder: 2,
      taskTemplates: { create: [
        { name: "مراجعة الاشتراطات", defaultDuration: 1, sortOrder: 1 },
        { name: "تقديم الطلب", defaultDuration: 1, sortOrder: 2 },
        { name: "الفحص الميداني", defaultDuration: 3, sortOrder: 3 },
        { name: "استلام الرخصة", defaultDuration: 2, sortOrder: 4 },
      ]},
    },
  });

  // 3. إصدار شهادة زكاة
  const svcT3 = await prisma.serviceTemplate.create({
    data: {
      name: "إصدار شهادة زكاة", description: "إعداد وتقديم الإقرار الزكوي واستلام الشهادة",
      defaultPrice: 800, defaultDuration: 3, workflowType: "SEQUENTIAL", categoryId: catGov.id, sortOrder: 3,
      taskTemplates: { create: [
        { name: "إعداد الإقرار", defaultDuration: 1, sortOrder: 1 },
        { name: "تقديم ومراجعة", defaultDuration: 1, sortOrder: 2 },
        { name: "استلام الشهادة", defaultDuration: 1, sortOrder: 3 },
      ]},
    },
  });

  // 4. إعداد القوائم المالية
  const svcT4 = await prisma.serviceTemplate.create({
    data: {
      name: "إعداد القوائم المالية", description: "إعداد القوائم المالية السنوية الكاملة",
      defaultPrice: 5000, defaultDuration: 14, workflowType: "INDEPENDENT", categoryId: catAcc.id, sortOrder: 1,
      taskTemplates: { create: [
        { name: "جمع البيانات", defaultDuration: 3, sortOrder: 1 },
        { name: "إعداد الميزانية", defaultDuration: 5, sortOrder: 2 },
        { name: "إعداد قائمة الدخل", defaultDuration: 3, sortOrder: 3 },
        { name: "المراجعة النهائية", defaultDuration: 3, sortOrder: 4 },
      ]},
    },
  });

  // 5. تقديم إقرار ضريبي
  const svcT5 = await prisma.serviceTemplate.create({
    data: {
      name: "تقديم إقرار ضريبي", description: "مراجعة وإعداد وتقديم الإقرار الضريبي",
      defaultPrice: 3000, defaultDuration: 5, workflowType: "SEQUENTIAL", categoryId: catAcc.id, sortOrder: 2,
      taskTemplates: { create: [
        { name: "مراجعة الحسابات", defaultDuration: 2, sortOrder: 1 },
        { name: "إعداد الإقرار", defaultDuration: 2, sortOrder: 2 },
        { name: "التقديم والمتابعة", defaultDuration: 1, sortOrder: 3 },
      ]},
    },
  });

  // 6. نقل كفالة
  const svcT6 = await prisma.serviceTemplate.create({
    data: {
      name: "نقل كفالة", description: "إجراءات نقل كفالة موظف",
      defaultPrice: 1200, defaultDuration: 10, workflowType: "SEQUENTIAL", categoryId: catHR.id, sortOrder: 1,
      taskTemplates: { create: [
        { name: "مراجعة الشروط", defaultDuration: 1, sortOrder: 1 },
        { name: "تقديم الطلب", defaultDuration: 2, sortOrder: 2 },
        { name: "موافقة الجهات", defaultDuration: 5, sortOrder: 3 },
        { name: "إنهاء الإجراءات", defaultDuration: 2, sortOrder: 4 },
      ]},
    },
  });

  // 7. تجديد إقامة
  const svcT7 = await prisma.serviceTemplate.create({
    data: {
      name: "تجديد إقامة", description: "إجراءات تجديد إقامة موظف",
      defaultPrice: 500, defaultDuration: 5, workflowType: "SEQUENTIAL", categoryId: catHR.id, sortOrder: 2,
      taskTemplates: { create: [
        { name: "مراجعة البيانات", defaultDuration: 1, sortOrder: 1 },
        { name: "السداد", defaultDuration: 1, sortOrder: 2 },
        { name: "تقديم الطلب", defaultDuration: 1, sortOrder: 3 },
        { name: "استلام الإقامة", defaultDuration: 2, sortOrder: 4 },
      ]},
    },
  });

  // 8. صياغة عقد
  const svcT8 = await prisma.serviceTemplate.create({
    data: {
      name: "صياغة عقد", description: "صياغة ومراجعة العقود التجارية والقانونية",
      defaultPrice: 3500, defaultDuration: 7, workflowType: "INDEPENDENT", categoryId: catLegal.id, sortOrder: 1,
      taskTemplates: { create: [
        { name: "دراسة المتطلبات", defaultDuration: 2, sortOrder: 1 },
        { name: "صياغة المسودة", defaultDuration: 3, sortOrder: 2 },
        { name: "المراجعة القانونية", defaultDuration: 2, sortOrder: 3 },
      ]},
    },
  });

  const allSvcTemplates = [svcT1, svcT2, svcT3, svcT4, svcT5, svcT6, svcT7, svcT8];

  // =============================
  // هـ. ربط الموظفين المؤهلين
  // =============================
  const employeeServiceMap: { svcIdx: number; userIds: string[] }[] = [
    { svcIdx: 0, userIds: [exec1.id, exec2.id, provider3.id] },         // سجل تجاري → منفذين + معقب
    { svcIdx: 1, userIds: [exec1.id, provider3.id, exec2.id] },         // رخصة بلدية → منفذ + معقب
    { svcIdx: 2, userIds: [exec1.id, provider1.id, provider3.id] },     // شهادة زكاة → منفذ + محاسب + معقب
    { svcIdx: 3, userIds: [provider1.id, exec2.id, provider2.id] },     // قوائم مالية → محاسب + منفذ + محامي
    { svcIdx: 4, userIds: [provider1.id, exec1.id, exec2.id] },         // إقرار ضريبي → محاسب + منفذين
    { svcIdx: 5, userIds: [exec1.id, exec2.id, provider3.id, provider1.id] }, // نقل كفالة → منفذين + معقب + محاسب
    { svcIdx: 6, userIds: [exec2.id, provider3.id, exec1.id] },         // تجديد إقامة → منفذ + معقب
    { svcIdx: 7, userIds: [provider2.id, exec1.id, exec2.id, provider1.id] }, // صياغة عقد → محامي + منفذين + محاسب
  ];

  let totalEmployeeLinks = 0;
  for (const mapping of employeeServiceMap) {
    for (const userId of mapping.userIds) {
      await prisma.serviceTemplateEmployee.create({
        data: { serviceTemplateId: allSvcTemplates[mapping.svcIdx].id, userId },
      });
      totalEmployeeLinks++;
    }
  }

  // Count task templates
  const totalTaskTemplates = 4 + 4 + 3 + 4 + 3 + 4 + 4 + 3; // = 29

  console.log(`  ✓ 4 فئات، 8 قوالب خدمات، ${totalTaskTemplates} مهمة قالب، ${totalEmployeeLinks} ربط موظف`);

  // =============================
  // و. قوالب المشاريع
  // =============================
  console.log("📂 إنشاء قوالب المشاريع...");

  const projTemplate1 = await prisma.projectTemplate.create({
    data: {
      name: "تأسيس شركة جديدة", description: "قالب شامل لتأسيس شركة جديدة (سجل تجاري + رخصة بلدية + شهادة زكاة)",
      workflowType: "SEQUENTIAL", isSystem: true, createdById: admin.id,
      services: { create: [
        { serviceTemplateId: svcT1.id, sortOrder: 1 },
        { serviceTemplateId: svcT2.id, sortOrder: 2 },
        { serviceTemplateId: svcT3.id, sortOrder: 3 },
      ]},
    },
  });

  const projTemplate2 = await prisma.projectTemplate.create({
    data: {
      name: "تجديدات سنوية", description: "تجديد السجل التجاري + الرخصة البلدية + الإقرار الضريبي",
      workflowType: "INDEPENDENT", isSystem: true, createdById: admin.id,
      services: { create: [
        { serviceTemplateId: svcT1.id, sortOrder: 1 },
        { serviceTemplateId: svcT2.id, sortOrder: 2 },
        { serviceTemplateId: svcT5.id, sortOrder: 3 },
      ]},
    },
  });

  const projTemplate3 = await prisma.projectTemplate.create({
    data: {
      name: "حزمة موارد بشرية", description: "نقل كفالة + تجديد إقامة",
      workflowType: "SEQUENTIAL", isSystem: true, createdById: admin.id,
      services: { create: [
        { serviceTemplateId: svcT6.id, sortOrder: 1 },
        { serviceTemplateId: svcT7.id, sortOrder: 2 },
      ]},
    },
  });

  console.log("  ✓ 3 قوالب مشاريع");

  // =============================
  // ز. مشاريع تجريبية
  // =============================
  console.log("🏗️ إنشاء المشاريع...");

  // مشروع 1: تأسيس مؤسسة النور (ACTIVE، تسلسلي)
  const project1 = await prisma.project.create({
    data: {
      name: "تأسيس مؤسسة النور", description: "تأسيس مؤسسة النور التجارية بالكامل",
      status: "ACTIVE", priority: "HIGH", workflowType: "SEQUENTIAL",
      totalPrice: 4300, startDate: daysAgo(10), endDate: daysLater(30),
      clientId: client1.id, managerId: manager.id, templateId: projTemplate1.id,
    },
  });

  const p1svc1 = await prisma.service.create({
    data: { name: "إصدار/تجديد سجل تجاري", price: 1500, duration: 5, category: "خدمات حكومية", status: "IN_PROGRESS", clientId: client1.id, projectId: project1.id },
  });
  const p1svc2 = await prisma.service.create({
    data: { name: "تجديد رخصة بلدية", price: 2000, duration: 7, category: "خدمات حكومية", status: "PENDING", clientId: client1.id, projectId: project1.id },
  });
  const p1svc3 = await prisma.service.create({
    data: { name: "إصدار شهادة زكاة", price: 800, duration: 3, category: "خدمات حكومية", status: "PENDING", clientId: client1.id, projectId: project1.id },
  });

  const p1Tasks = await Promise.all([
    prisma.task.create({ data: { title: "مراجعة المستندات", status: "DONE", priority: "HIGH", order: 1, dueDate: daysAgo(8), projectId: project1.id, serviceId: p1svc1.id, assigneeId: exec1.id } }),
    prisma.task.create({ data: { title: "تقديم الطلب", status: "IN_PROGRESS", priority: "HIGH", order: 2, dueDate: daysLater(2), projectId: project1.id, serviceId: p1svc1.id, assigneeId: provider3.id } }),
    prisma.task.create({ data: { title: "متابعة", status: "TODO", priority: "MEDIUM", order: 3, dueDate: daysLater(5), projectId: project1.id, serviceId: p1svc1.id, assigneeId: provider3.id } }),
    prisma.task.create({ data: { title: "استلام وتسليم", status: "TODO", priority: "MEDIUM", order: 4, dueDate: daysLater(7), projectId: project1.id, serviceId: p1svc1.id, assigneeId: exec1.id } }),
    prisma.task.create({ data: { title: "مراجعة الاشتراطات", status: "TODO", priority: "MEDIUM", order: 5, dueDate: daysLater(10), projectId: project1.id, serviceId: p1svc2.id, assigneeId: exec2.id } }),
    prisma.task.create({ data: { title: "تقديم طلب الرخصة", status: "TODO", priority: "MEDIUM", order: 6, dueDate: daysLater(15), projectId: project1.id, serviceId: p1svc2.id, assigneeId: provider3.id } }),
    prisma.task.create({ data: { title: "الفحص الميداني", status: "TODO", priority: "MEDIUM", order: 7, dueDate: daysLater(20), projectId: project1.id, serviceId: p1svc2.id, assigneeId: exec2.id } }),
    prisma.task.create({ data: { title: "استلام الرخصة", status: "TODO", priority: "LOW", order: 8, dueDate: daysLater(25), projectId: project1.id, serviceId: p1svc2.id, assigneeId: exec1.id } }),
    prisma.task.create({ data: { title: "إعداد الإقرار الزكوي", status: "TODO", priority: "LOW", order: 9, dueDate: daysLater(27), projectId: project1.id, serviceId: p1svc3.id, assigneeId: provider1.id } }),
    prisma.task.create({ data: { title: "تقديم ومراجعة الزكاة", status: "TODO", priority: "LOW", order: 10, dueDate: daysLater(28), projectId: project1.id, serviceId: p1svc3.id, assigneeId: provider1.id } }),
    prisma.task.create({ data: { title: "استلام شهادة الزكاة", status: "TODO", priority: "LOW", order: 11, dueDate: daysLater(30), projectId: project1.id, serviceId: p1svc3.id, assigneeId: exec1.id } }),
  ]);

  // مشروع 2: تجديدات شركة الفيصل (ACTIVE، مستقل)
  const project2 = await prisma.project.create({
    data: {
      name: "تجديدات شركة الفيصل", description: "تجديد المستندات والتراخيص السنوية",
      status: "ACTIVE", priority: "MEDIUM", workflowType: "INDEPENDENT",
      totalPrice: 6500, startDate: daysAgo(15), endDate: daysLater(15),
      clientId: client2.id, managerId: manager.id, templateId: projTemplate2.id,
    },
  });

  const p2svc1 = await prisma.service.create({
    data: { name: "تجديد سجل تجاري", price: 1500, duration: 5, category: "خدمات حكومية", status: "COMPLETED", clientId: client2.id, projectId: project2.id },
  });
  const p2svc2 = await prisma.service.create({
    data: { name: "تجديد رخصة بلدية", price: 2000, duration: 7, category: "خدمات حكومية", status: "IN_PROGRESS", clientId: client2.id, projectId: project2.id },
  });
  const p2svc3 = await prisma.service.create({
    data: { name: "تقديم إقرار ضريبي", price: 3000, duration: 5, category: "خدمات محاسبية", status: "PENDING", clientId: client2.id, projectId: project2.id },
  });

  const p2Tasks = await Promise.all([
    prisma.task.create({ data: { title: "مراجعة مستندات السجل", status: "DONE", priority: "MEDIUM", order: 1, dueDate: daysAgo(12), projectId: project2.id, serviceId: p2svc1.id, assigneeId: exec1.id } }),
    prisma.task.create({ data: { title: "تقديم طلب تجديد السجل", status: "DONE", priority: "MEDIUM", order: 2, dueDate: daysAgo(10), projectId: project2.id, serviceId: p2svc1.id, assigneeId: provider3.id } }),
    prisma.task.create({ data: { title: "متابعة السجل", status: "DONE", priority: "MEDIUM", order: 3, dueDate: daysAgo(7), projectId: project2.id, serviceId: p2svc1.id, assigneeId: provider3.id } }),
    prisma.task.create({ data: { title: "استلام السجل", status: "DONE", priority: "LOW", order: 4, dueDate: daysAgo(5), projectId: project2.id, serviceId: p2svc1.id, assigneeId: exec1.id } }),
    prisma.task.create({ data: { title: "مراجعة اشتراطات الرخصة", status: "DONE", priority: "MEDIUM", order: 5, dueDate: daysAgo(3), projectId: project2.id, serviceId: p2svc2.id, assigneeId: exec2.id } }),
    prisma.task.create({ data: { title: "تقديم طلب تجديد الرخصة", status: "IN_PROGRESS", priority: "MEDIUM", order: 6, dueDate: daysLater(2), projectId: project2.id, serviceId: p2svc2.id, assigneeId: provider3.id } }),
    prisma.task.create({ data: { title: "الفحص الميداني للرخصة", status: "TODO", priority: "HIGH", order: 7, dueDate: daysLater(7), projectId: project2.id, serviceId: p2svc2.id, assigneeId: exec2.id } }),
    prisma.task.create({ data: { title: "استلام الرخصة المجددة", status: "TODO", priority: "MEDIUM", order: 8, dueDate: daysLater(10), projectId: project2.id, serviceId: p2svc2.id, assigneeId: exec1.id } }),
    prisma.task.create({ data: { title: "مراجعة الحسابات", status: "TODO", priority: "MEDIUM", order: 9, dueDate: daysLater(8), projectId: project2.id, serviceId: p2svc3.id, assigneeId: provider1.id } }),
    prisma.task.create({ data: { title: "إعداد الإقرار الضريبي", status: "TODO", priority: "HIGH", order: 10, dueDate: daysLater(12), projectId: project2.id, serviceId: p2svc3.id, assigneeId: provider1.id } }),
    prisma.task.create({ data: { title: "التقديم والمتابعة", status: "TODO", priority: "MEDIUM", order: 11, dueDate: daysLater(15), projectId: project2.id, serviceId: p2svc3.id, assigneeId: exec1.id } }),
  ]);

  // مشروع 3: خدمات مجموعة سلطان (DRAFT)
  const project3 = await prisma.project.create({
    data: {
      name: "خدمات مجموعة سلطان", description: "حزمة موارد بشرية لمجموعة سلطان",
      status: "DRAFT", priority: "LOW", workflowType: "SEQUENTIAL",
      totalPrice: 1700, startDate: daysLater(5), endDate: daysLater(20),
      clientId: client3.id, managerId: admin.id, templateId: projTemplate3.id,
    },
  });

  const p3svc1 = await prisma.service.create({
    data: { name: "نقل كفالة", price: 1200, duration: 10, category: "خدمات موارد بشرية", status: "PENDING", clientId: client3.id, projectId: project3.id },
  });
  const p3svc2 = await prisma.service.create({
    data: { name: "تجديد إقامة", price: 500, duration: 5, category: "خدمات موارد بشرية", status: "PENDING", clientId: client3.id, projectId: project3.id },
  });

  await Promise.all([
    prisma.task.create({ data: { title: "مراجعة شروط النقل", status: "TODO", priority: "MEDIUM", order: 1, dueDate: daysLater(6), projectId: project3.id, serviceId: p3svc1.id, assigneeId: exec1.id } }),
    prisma.task.create({ data: { title: "تقديم طلب النقل", status: "TODO", priority: "MEDIUM", order: 2, dueDate: daysLater(8), projectId: project3.id, serviceId: p3svc1.id, assigneeId: provider3.id } }),
    prisma.task.create({ data: { title: "موافقة الجهات", status: "TODO", priority: "HIGH", order: 3, dueDate: daysLater(13), projectId: project3.id, serviceId: p3svc1.id, assigneeId: exec2.id } }),
    prisma.task.create({ data: { title: "إنهاء إجراءات النقل", status: "TODO", priority: "MEDIUM", order: 4, dueDate: daysLater(15), projectId: project3.id, serviceId: p3svc1.id, assigneeId: exec1.id } }),
    prisma.task.create({ data: { title: "مراجعة بيانات الإقامة", status: "TODO", priority: "LOW", order: 5, dueDate: daysLater(16), projectId: project3.id, serviceId: p3svc2.id, assigneeId: exec2.id } }),
    prisma.task.create({ data: { title: "سداد رسوم الإقامة", status: "TODO", priority: "LOW", order: 6, dueDate: daysLater(17), projectId: project3.id, serviceId: p3svc2.id, assigneeId: exec1.id } }),
    prisma.task.create({ data: { title: "تقديم طلب التجديد", status: "TODO", priority: "LOW", order: 7, dueDate: daysLater(18), projectId: project3.id, serviceId: p3svc2.id, assigneeId: provider3.id } }),
    prisma.task.create({ data: { title: "استلام الإقامة المجددة", status: "TODO", priority: "LOW", order: 8, dueDate: daysLater(20), projectId: project3.id, serviceId: p3svc2.id, assigneeId: exec2.id } }),
  ]);

  console.log("  ✓ 3 مشاريع، 8 خدمات مشاريع، 30 مهمة");

  // =============================
  // ح. خدمات مفردة (بدون مشروع)
  // =============================
  console.log("🔧 إنشاء خدمات مفردة...");

  const standaloneSvc1 = await prisma.service.create({
    data: { name: "صياغة عقد", price: 3500, duration: 7, category: "خدمات قانونية", status: "IN_PROGRESS", clientId: client1.id },
  });

  const standaloneSvc2 = await prisma.service.create({
    data: { name: "تقديم إقرار ضريبي", price: 3000, duration: 5, category: "خدمات محاسبية", status: "PENDING", clientId: client2.id },
  });

  console.log("  ✓ 2 خدمات مفردة");

  // =============================
  // ط. موظفين HR
  // =============================
  console.log("👥 إنشاء موظفي HR...");

  const employees = [
    // شركة مرسى (3 موظفين)
    { name: "سامي الغامدي", nationality: "سعودي", nationalId: "1100000001", jobTitle: "مدير عمليات", department: "العمليات", baseSalary: 15000, housingAllowance: 3000, transportAllowance: 800, phone: "0560001111", email: "sami@marsa.sa", companyId: companyMarsa.id, hireDate: daysAgo(730) },
    { name: "هند القحطاني", nationality: "سعودية", nationalId: "1100000002", jobTitle: "محاسبة", department: "المالية", baseSalary: 9000, housingAllowance: 2000, transportAllowance: 500, phone: "0560002222", email: "hind@marsa.sa", companyId: companyMarsa.id, hireDate: daysAgo(365) },
    { name: "راكان العمري", nationality: "سعودي", nationalId: "1100000003", jobTitle: "مسؤول تقنية", department: "التقنية", baseSalary: 12000, housingAllowance: 2500, transportAllowance: 600, phone: "0560003333", email: "rakan@marsa.sa", companyId: companyMarsa.id, hireDate: daysAgo(200) },

    // مؤسسة النور (3 موظفين)
    { name: "فيصل العتيبي", nationality: "سعودي", nationalId: "1200000001", jobTitle: "محاسب", department: "المالية", baseSalary: 8000, housingAllowance: 2000, transportAllowance: 500, phone: "0561111111", email: "faisal@alnoor.sa", companyId: company1.id, hireDate: daysAgo(365) },
    { name: "ناصر الشمري", nationality: "سعودي", nationalId: "1200000002", jobTitle: "مدير مبيعات", department: "المبيعات", baseSalary: 12000, housingAllowance: 3000, transportAllowance: 800, phone: "0562222222", email: "nasser@alnoor.sa", companyId: company1.id, hireDate: daysAgo(200) },
    { name: "أحمد خان", nationality: "باكستاني", nationalId: "2200000001", jobTitle: "فني", department: "العمليات", baseSalary: 4500, housingAllowance: 1200, transportAllowance: 300, phone: "0563333333", email: "ahmed.khan@alnoor.sa", companyId: company1.id, hireDate: daysAgo(500), residencyExpiry: daysLater(20), insuranceExpiry: daysLater(15) },

    // شركة الفيصل (2 موظفين)
    { name: "محمد إبراهيم", nationality: "مصري", nationalId: "2200000002", jobTitle: "مدير مشاريع", department: "العمليات", baseSalary: 9000, housingAllowance: 2500, transportAllowance: 600, phone: "0564444444", email: "mohamed@alfaisal.sa", companyId: company2.id, hireDate: daysAgo(730), residencyExpiry: daysLater(45) },
    { name: "عمر حسن", nationality: "سوداني", nationalId: "2200000003", jobTitle: "فني كهرباء", department: "الصيانة", baseSalary: 5500, housingAllowance: 1500, transportAllowance: 400, phone: "0564445555", email: "omar@alfaisal.sa", companyId: company2.id, hireDate: daysAgo(400), residencyExpiry: daysLater(90), insuranceExpiry: daysLater(60) },

    // مجموعة سلطان (2 موظفين)
    { name: "عبدالرحمن السيد", nationality: "سعودي", nationalId: "1200000003", jobTitle: "مسؤول موارد بشرية", department: "الموارد البشرية", baseSalary: 7500, housingAllowance: 1800, transportAllowance: 400, phone: "0565555555", email: "abdulrahman@sultan.sa", companyId: company3.id, hireDate: daysAgo(150) },
    { name: "علي رضا", nationality: "هندي", nationalId: "2200000004", jobTitle: "مبرمج", department: "التقنية", baseSalary: 8000, housingAllowance: 2000, transportAllowance: 500, phone: "0565556666", email: "ali@sultan.sa", companyId: company3.id, hireDate: daysAgo(300), residencyExpiry: daysLater(30), insuranceExpiry: daysLater(25) },
  ];

  for (const emp of employees) {
    await prisma.employee.create({ data: emp });
  }

  console.log(`  ✓ ${employees.length} موظفين`);

  // =============================
  // ي. الفواتير والمدفوعات
  // =============================
  console.log("💰 إنشاء الفواتير...");

  // فاتورة 1 - مدفوعة (مشروع 2 - شركة الفيصل)
  const inv1 = await prisma.invoice.create({
    data: {
      invoiceNumber: "INV-0001", title: "تجديدات شركة الفيصل السنوية", description: "فاتورة خدمات التجديدات",
      subtotal: 6500, taxRate: 15, taxAmount: 975, totalAmount: 7475, status: "PAID",
      dueDate: daysAgo(5), companyId: company2.id, clientId: client2.id, createdById: admin.id, projectId: project2.id,
      items: { create: [
        { description: "تجديد سجل تجاري", quantity: 1, unitPrice: 1500, total: 1500 },
        { description: "تجديد رخصة بلدية", quantity: 1, unitPrice: 2000, total: 2000 },
        { description: "تقديم إقرار ضريبي", quantity: 1, unitPrice: 3000, total: 3000 },
      ]},
    },
  });

  await prisma.payment.create({
    data: { amount: 7475, method: "BANK_TRANSFER", referenceNumber: "TRF-2026-001", invoiceId: inv1.id, notes: "سداد كامل بتحويل بنكي" },
  });

  // فاتورة 2 - مدفوعة (مؤسسة النور - خدمة صياغة عقد)
  const inv2 = await prisma.invoice.create({
    data: {
      invoiceNumber: "INV-0002", title: "صياغة عقد - مؤسسة النور", description: "فاتورة خدمة صياغة عقد تجاري",
      subtotal: 3500, taxRate: 15, taxAmount: 525, totalAmount: 4025, status: "PAID",
      dueDate: daysAgo(10), companyId: company1.id, clientId: client1.id, createdById: admin.id,
      items: { create: [
        { description: "صياغة عقد تجاري", quantity: 1, unitPrice: 3500, total: 3500 },
      ]},
    },
  });

  await prisma.payment.create({
    data: { amount: 4025, method: "CASH", invoiceId: inv2.id, notes: "سداد نقدي" },
  });

  // فاتورة 3 - مرسلة (مشروع 1 - مؤسسة النور)
  const inv3 = await prisma.invoice.create({
    data: {
      invoiceNumber: "INV-0003", title: "تأسيس مؤسسة النور", description: "فاتورة خدمات تأسيس المؤسسة",
      subtotal: 4300, taxRate: 15, taxAmount: 645, totalAmount: 4945, status: "SENT",
      dueDate: daysLater(20), companyId: company1.id, clientId: client1.id, createdById: admin.id, projectId: project1.id,
      items: { create: [
        { description: "إصدار سجل تجاري", quantity: 1, unitPrice: 1500, total: 1500 },
        { description: "تجديد رخصة بلدية", quantity: 1, unitPrice: 2000, total: 2000 },
        { description: "إصدار شهادة زكاة", quantity: 1, unitPrice: 800, total: 800 },
      ]},
    },
  });

  // فاتورة 4 - متأخرة (مجموعة سلطان)
  const inv4 = await prisma.invoice.create({
    data: {
      invoiceNumber: "INV-0004", title: "استشارة قانونية - مجموعة سلطان", description: "فاتورة استشارة قانونية",
      subtotal: 3500, taxRate: 15, taxAmount: 525, totalAmount: 4025, status: "OVERDUE",
      dueDate: daysAgo(15), companyId: company3.id, clientId: client3.id, createdById: admin.id,
      items: { create: [{ description: "استشارة قانونية شاملة", quantity: 1, unitPrice: 3500, total: 3500 }] },
    },
  });

  // فاتورة 5 - مسودة (شركة الفيصل)
  const inv5 = await prisma.invoice.create({
    data: {
      invoiceNumber: "INV-0005", title: "إقرار ضريبي - شركة الفيصل", description: "فاتورة خدمة الإقرار الضريبي",
      subtotal: 3000, taxRate: 15, taxAmount: 450, totalAmount: 3450, status: "DRAFT",
      dueDate: daysLater(30), companyId: company2.id, clientId: client2.id, createdById: manager.id,
      items: { create: [{ description: "تقديم إقرار ضريبي", quantity: 1, unitPrice: 3000, total: 3000 }] },
    },
  });

  console.log("  ✓ 5 فواتير، 2 مدفوعات");

  // =============================
  // ك. التذكيرات
  // =============================
  console.log("🔔 إنشاء التذكيرات...");

  const reminders = [
    { title: "تجديد إقامة أحمد خان", type: "RESIDENCY_EXPIRY" as const, dueDate: daysLater(20), priority: "CRITICAL" as const, companyId: company1.id, clientId: client1.id },
    { title: "تجديد تأمين أحمد خان", type: "INSURANCE_EXPIRY" as const, dueDate: daysLater(15), priority: "HIGH" as const, companyId: company1.id, clientId: client1.id },
    { title: "تجديد الرخصة البلدية - مؤسسة النور", type: "LICENSE_EXPIRY" as const, dueDate: daysLater(30), priority: "MEDIUM" as const, companyId: company1.id, clientId: client1.id },
    { title: "تجديد إقامة محمد إبراهيم", type: "RESIDENCY_EXPIRY" as const, dueDate: daysLater(45), priority: "HIGH" as const, companyId: company2.id, clientId: client2.id },
    { title: "تجديد تأمين عمر حسن", type: "INSURANCE_EXPIRY" as const, dueDate: daysLater(60), priority: "MEDIUM" as const, companyId: company2.id, clientId: client2.id },
    { title: "تجديد إقامة علي رضا", type: "RESIDENCY_EXPIRY" as const, dueDate: daysLater(30), priority: "HIGH" as const, companyId: company3.id, clientId: client3.id },
    { title: "تجديد عقد إيجار مجموعة سلطان", type: "CONTRACT_RENEWAL" as const, dueDate: daysLater(90), priority: "LOW" as const, companyId: company3.id, clientId: client3.id },
    { title: "متابعة فاتورة متأخرة - مجموعة سلطان", type: "CUSTOM" as const, dueDate: daysLater(3), priority: "HIGH" as const, companyId: company3.id, clientId: client3.id },
  ];

  for (const r of reminders) {
    await prisma.reminder.create({
      data: { ...r, createdById: admin.id, status: "PENDING" },
    });
  }

  console.log("  ✓ 8 تذكيرات");

  // =============================
  // ل. وثائق رسمية
  // =============================
  console.log("📄 إنشاء الوثائق...");

  const docs = [
    // مؤسسة النور (4 وثائق)
    { title: "سجل تجاري - مؤسسة النور", type: "COMMERCIAL_REGISTER" as const, documentNumber: "1010000001", issueDate: daysAgo(350), expiryDate: daysLater(15), status: "EXPIRING_SOON" as const, ownerId: client1.id, companyId: company1.id },
    { title: "رخصة بلدية - مؤسسة النور", type: "MUNICIPAL_LICENSE" as const, documentNumber: "ML-2025-001", issueDate: daysAgo(300), expiryDate: daysLater(25), status: "EXPIRING_SOON" as const, ownerId: client1.id, companyId: company1.id },
    { title: "شهادة زكاة - مؤسسة النور", type: "ZAKAT_CERTIFICATE" as const, documentNumber: "ZK-2025-001", issueDate: daysAgo(400), expiryDate: daysAgo(10), status: "EXPIRED" as const, ownerId: client1.id, companyId: company1.id },
    { title: "عقد إيجار - مؤسسة النور", type: "LEASE_CONTRACT" as const, documentNumber: "LC-2025-001", issueDate: daysAgo(200), expiryDate: daysLater(165), status: "VALID" as const, ownerId: client1.id, companyId: company1.id },

    // شركة الفيصل (3 وثائق)
    { title: "سجل تجاري - شركة الفيصل", type: "COMMERCIAL_REGISTER" as const, documentNumber: "1010000002", issueDate: daysAgo(100), expiryDate: daysLater(265), status: "VALID" as const, ownerId: client2.id, companyId: company2.id },
    { title: "رخصة بلدية - شركة الفيصل", type: "MUNICIPAL_LICENSE" as const, documentNumber: "ML-2025-002", issueDate: daysAgo(400), expiryDate: daysAgo(5), status: "EXPIRED" as const, ownerId: client2.id, companyId: company2.id },
    { title: "شهادة زكاة - شركة الفيصل", type: "ZAKAT_CERTIFICATE" as const, documentNumber: "ZK-2025-002", issueDate: daysAgo(150), expiryDate: daysLater(215), status: "VALID" as const, ownerId: client2.id, companyId: company2.id },

    // مجموعة سلطان (4 وثائق)
    { title: "سجل تجاري - مجموعة سلطان", type: "COMMERCIAL_REGISTER" as const, documentNumber: "1010000003", issueDate: daysAgo(50), expiryDate: daysLater(315), status: "VALID" as const, ownerId: client3.id, companyId: company3.id },
    { title: "رخصة بلدية - مجموعة سلطان", type: "MUNICIPAL_LICENSE" as const, documentNumber: "ML-2025-003", issueDate: daysAgo(250), expiryDate: daysLater(115), status: "VALID" as const, ownerId: client3.id, companyId: company3.id },
    { title: "شهادة زكاة - مجموعة سلطان", type: "ZAKAT_CERTIFICATE" as const, documentNumber: "ZK-2025-003", issueDate: daysAgo(180), expiryDate: daysLater(10), status: "EXPIRING_SOON" as const, ownerId: client3.id, companyId: company3.id },
    { title: "عقد إيجار - مجموعة سلطان", type: "LEASE_CONTRACT" as const, documentNumber: "LC-2025-003", issueDate: daysAgo(100), expiryDate: daysLater(265), status: "VALID" as const, ownerId: client3.id, companyId: company3.id },
  ];

  for (const doc of docs) {
    await prisma.document.create({ data: { ...doc, isLinkedToCompany: true } });
  }

  console.log(`  ✓ ${docs.length} وثائق`);

  // =============================
  // م. عمليات الكاشير
  // =============================
  console.log("🧾 إنشاء عمليات الكاشير...");

  await prisma.cashierTransaction.create({
    data: {
      transactionNumber: "TXN-0001", totalAmount: 3500, taxAmount: 525, grandTotal: 4025,
      paymentMethod: "CASH", amountReceived: 4100, changeAmount: 75, status: "COMPLETED",
      clientId: client1.id, invoiceId: inv2.id, cashierId: exec1.id,
    },
  });

  await prisma.cashierTransaction.create({
    data: {
      transactionNumber: "TXN-0002", totalAmount: 6500, taxAmount: 975, grandTotal: 7475,
      paymentMethod: "BANK_TRANSFER", referenceNumber: "TRF-2026-001", status: "COMPLETED",
      clientId: client2.id, invoiceId: inv1.id, cashierId: admin.id,
    },
  });

  console.log("  ✓ 2 عمليات كاشير");

  // =============================
  // ن. تكاليف المهام وطلبات الصرف
  // =============================
  console.log("💳 إنشاء طلبات الصرف...");

  // طلب 1: معلق عند المسؤول (provider3 - تقديم الطلب في مشروع 1)
  const tc1 = await prisma.taskCost.create({
    data: { taskId: p1Tasks[1].id, providerId: provider3.id, amount: 150, notes: "تكلفة تقديم طلب سجل تجاري" },
  });

  await prisma.paymentRequest.create({
    data: {
      requestNumber: "PAY-REQ-0001", amount: 150, status: "PENDING_SUPERVISOR",
      taskCostId: tc1.id, providerId: provider3.id, requestedById: manager.id,
      notes: "طلب صرف لمهمة تعقيب حكومي",
    },
  });

  // طلب 2: معلق عند المالي (provider1 - مراجعة الحسابات في مشروع 2)
  const tc2 = await prisma.taskCost.create({
    data: { taskId: p2Tasks[4].id, providerId: provider1.id, amount: 200, notes: "تكلفة مراجعة مستندات السجل" },
  });

  await prisma.paymentRequest.create({
    data: {
      requestNumber: "PAY-REQ-0002", amount: 200, status: "PENDING_FINANCE",
      taskCostId: tc2.id, providerId: provider1.id, requestedById: manager.id,
      notes: "طلب صرف لمهمة محاسبة",
      supervisorApproval: true, supervisorApprovedAt: daysAgo(2), supervisorNotes: "تمت الموافقة",
    },
  });

  // طلب 3: تم صرفه (provider3 - مراجعة مستندات السجل في مشروع 2)
  const tc3 = await prisma.taskCost.create({
    data: { taskId: p2Tasks[0].id, providerId: provider3.id, amount: 150, notes: "تكلفة متابعة تجديد السجل" },
  });

  await prisma.paymentRequest.create({
    data: {
      requestNumber: "PAY-REQ-0003", amount: 150, status: "PAID",
      taskCostId: tc3.id, providerId: provider3.id, requestedById: manager.id,
      notes: "طلب صرف مكتمل",
      supervisorApproval: true, supervisorApprovedAt: daysAgo(10), supervisorNotes: "موافق",
      financeApproval: true, financeApprovedAt: daysAgo(8), financeNotes: "تمت المراجعة",
      treasuryApproval: true, treasuryApprovedAt: daysAgo(6), treasuryNotes: "تم الصرف",
      paymentMethod: "BANK_TRANSFER", paymentReference: "TRF-PAY-001", paidAt: daysAgo(6),
    },
  });

  console.log("  ✓ 3 تكاليف مهام، 3 طلبات صرف");

  // =============================
  // الملخص
  // =============================
  console.log("\n✅ تم إنشاء جميع البيانات التجريبية بنجاح!\n");
  console.log("=== بيانات تسجيل الدخول ===");
  console.log("المدير:         admin@marsa.sa / 12345678");
  console.log("المشرف:         manager@marsa.sa / 12345678");
  console.log("المدير المالي:  finance@marsa.sa / 12345678");
  console.log("أمين الصندوق:   treasury@marsa.sa / 12345678");
  console.log("منفذ 1:         exec1@marsa.sa / 12345678");
  console.log("منفذ 2:         exec2@marsa.sa / 12345678");
  console.log("عميل 1 (FULL):  client1@marsa.sa / 12345678");
  console.log("عميل 2 (PER):   client2@marsa.sa / 12345678");
  console.log("عميل 3 (NONE):  client3@marsa.sa / 12345678");
  console.log("مقدم خدمة 1:    provider1@marsa.sa / 12345678");
  console.log("مقدم خدمة 2:    provider2@marsa.sa / 12345678");
  console.log("مقدم خدمة 3:    provider3@marsa.sa / 12345678");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});

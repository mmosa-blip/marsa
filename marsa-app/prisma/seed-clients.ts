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
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!admin) {
    console.log("يرجى تشغيل seed-projects.ts أولاً لإنشاء المستخدم الأساسي");
    return;
  }

  const password = await bcrypt.hash("12345678", 12);

  // ===== العميل الأول: أحمد المنصوري =====
  const client1 = await prisma.user.create({
    data: {
      email: "ahmed@almansouri.com",
      password,
      name: "أحمد المنصوري",
      role: "CLIENT",
      phone: "+966501234567",
    },
  });

  const company1 = await prisma.company.create({
    data: {
      name: "شركة المنصوري للتجارة",
      commercialRegister: "CR-10001",
      sector: "تجارة إلكترونية",
      ownerId: client1.id,
    },
  });

  const project1 = await prisma.project.create({
    data: {
      name: "منصة تجارة إلكترونية",
      status: "ACTIVE",
      priority: "HIGH",
      clientId: client1.id,
      managerId: admin.id,
      startDate: new Date("2026-01-15"),
      endDate: new Date("2026-06-15"),
    },
  });

  await prisma.task.createMany({
    data: [
      { title: "تصميم واجهات المتجر", status: "DONE", priority: "HIGH", projectId: project1.id, assigneeId: admin.id },
      { title: "تطوير سلة المشتريات", status: "DONE", priority: "HIGH", projectId: project1.id, assigneeId: admin.id },
      { title: "ربط بوابات الدفع", status: "IN_PROGRESS", priority: "URGENT", projectId: project1.id, assigneeId: admin.id },
      { title: "نظام إدارة المخزون", status: "TODO", priority: "MEDIUM", projectId: project1.id },
      { title: "اختبار ونشر", status: "TODO", priority: "HIGH", projectId: project1.id },
    ],
  });

  // خدمة مفردة للعميل الأول
  await prisma.service.create({
    data: {
      name: "تصميم شعار الشركة",
      description: "تصميم شعار احترافي مع دليل الهوية",
      category: "تصميم",
      price: 3500,
      duration: 7,
      clientId: client1.id,
      status: "COMPLETED",
    },
  });

  // فاتورة للعميل الأول
  const inv1 = await prisma.invoice.create({
    data: {
      invoiceNumber: "INV-C001",
      title: "تطوير منصة التجارة الإلكترونية - مرحلة أولى",
      subtotal: 30000,
      taxRate: 15,
      taxAmount: 4500,
      totalAmount: 34500,
      status: "SENT",
      dueDate: new Date("2026-04-01"),
      companyId: company1.id,
      projectId: project1.id,
      clientId: client1.id,
      createdById: admin.id,
      items: {
        create: [
          { description: "تصميم UI/UX", quantity: 1, unitPrice: 12000, total: 12000 },
          { description: "تطوير Frontend", quantity: 1, unitPrice: 10000, total: 10000 },
          { description: "تطوير Backend", quantity: 1, unitPrice: 8000, total: 8000 },
        ],
      },
    },
  });

  await prisma.payment.create({
    data: { amount: 15000, method: "BANK_TRANSFER", referenceNumber: "TRF-C001", invoiceId: inv1.id, notes: "دفعة مقدمة 50%" },
  });

  // تذكير للعميل الأول
  await prisma.reminder.create({
    data: {
      title: "تسليم المرحلة الأولى - منصة المنصوري",
      description: "مراجعة وتسليم المرحلة الأولى من مشروع التجارة الإلكترونية",
      type: "CUSTOM",
      dueDate: new Date("2026-04-01"),
      priority: "HIGH",
      companyId: company1.id,
      clientId: client1.id,
      createdById: admin.id,
    },
  });

  console.log("✅ تم إنشاء العميل: أحمد المنصوري + شركة + مشروع + خدمة + فاتورة + تذكير");

  // ===== العميل الثاني: سارة العتيبي =====
  const client2 = await prisma.user.create({
    data: {
      email: "sara@alotaibi-design.com",
      password,
      name: "سارة العتيبي",
      role: "CLIENT",
      phone: "+966559876543",
    },
  });

  const company2 = await prisma.company.create({
    data: {
      name: "استوديو سارة للتصميم",
      commercialRegister: "CR-10002",
      sector: "تصميم وإبداع",
      ownerId: client2.id,
    },
  });

  const project2 = await prisma.project.create({
    data: {
      name: "موقع معرض أعمال",
      status: "COMPLETED",
      priority: "MEDIUM",
      clientId: client2.id,
      managerId: admin.id,
      startDate: new Date("2025-11-01"),
      endDate: new Date("2026-01-30"),
    },
  });

  await prisma.task.createMany({
    data: [
      { title: "تصميم الصفحات", status: "DONE", priority: "HIGH", projectId: project2.id, assigneeId: admin.id },
      { title: "تطوير الموقع", status: "DONE", priority: "HIGH", projectId: project2.id, assigneeId: admin.id },
      { title: "رفع المحتوى", status: "DONE", priority: "MEDIUM", projectId: project2.id },
    ],
  });

  const project2b = await prisma.project.create({
    data: {
      name: "تطبيق حجز مواعيد",
      status: "ACTIVE",
      priority: "HIGH",
      clientId: client2.id,
      managerId: admin.id,
      startDate: new Date("2026-02-01"),
      endDate: new Date("2026-05-30"),
    },
  });

  await prisma.task.createMany({
    data: [
      { title: "تصميم شاشات التطبيق", status: "DONE", priority: "HIGH", projectId: project2b.id, assigneeId: admin.id },
      { title: "تطوير نظام الحجز", status: "IN_PROGRESS", priority: "URGENT", projectId: project2b.id, assigneeId: admin.id },
      { title: "إشعارات المواعيد", status: "TODO", priority: "MEDIUM", projectId: project2b.id },
      { title: "اختبار ونشر التطبيق", status: "TODO", priority: "HIGH", projectId: project2b.id },
    ],
  });

  // خدمة مفردة
  await prisma.service.create({
    data: {
      name: "إدارة حسابات التواصل الاجتماعي",
      description: "إدارة شهرية لحسابات انستقرام وتويتر",
      category: "تسويق رقمي",
      price: 5000,
      duration: 30,
      clientId: client2.id,
      status: "IN_PROGRESS",
    },
  });

  // فواتير للعميل الثاني
  const inv2 = await prisma.invoice.create({
    data: {
      invoiceNumber: "INV-C002",
      title: "موقع معرض الأعمال",
      subtotal: 12000,
      taxRate: 15,
      taxAmount: 1800,
      totalAmount: 13800,
      status: "PAID",
      dueDate: new Date("2026-01-30"),
      companyId: company2.id,
      projectId: project2.id,
      clientId: client2.id,
      createdById: admin.id,
      items: { create: [{ description: "تصميم وتطوير موقع معرض أعمال", quantity: 1, unitPrice: 12000, total: 12000 }] },
    },
  });

  await prisma.payment.create({
    data: { amount: 13800, method: "BANK_TRANSFER", referenceNumber: "TRF-C002", invoiceId: inv2.id, notes: "دفعة كاملة" },
  });

  const inv2b = await prisma.invoice.create({
    data: {
      invoiceNumber: "INV-C003",
      title: "تطبيق حجز مواعيد - مرحلة أولى",
      subtotal: 20000,
      taxRate: 15,
      taxAmount: 3000,
      totalAmount: 23000,
      status: "SENT",
      dueDate: new Date("2026-04-15"),
      companyId: company2.id,
      projectId: project2b.id,
      clientId: client2.id,
      createdById: admin.id,
      items: {
        create: [
          { description: "تصميم UI/UX للتطبيق", quantity: 1, unitPrice: 8000, total: 8000 },
          { description: "تطوير نظام الحجز", quantity: 1, unitPrice: 12000, total: 12000 },
        ],
      },
    },
  });

  await prisma.payment.create({
    data: { amount: 10000, method: "CREDIT_CARD", referenceNumber: "CC-C003", invoiceId: inv2b.id, notes: "دفعة مقدمة" },
  });

  // تذكيرات للعميل الثاني
  await prisma.reminder.createMany({
    data: [
      { title: "تجديد عقد إدارة السوشل ميديا", type: "CONTRACT_RENEWAL", dueDate: new Date("2026-04-01"), priority: "MEDIUM", companyId: company2.id, clientId: client2.id, createdById: admin.id },
      { title: "تسليم تطبيق الحجز - مرحلة أولى", type: "CUSTOM", dueDate: new Date("2026-04-15"), priority: "HIGH", companyId: company2.id, clientId: client2.id, createdById: admin.id },
    ],
  });

  console.log("✅ تم إنشاء العميلة: سارة العتيبي + شركة + 2 مشروع + خدمة + 2 فاتورة + 2 تذكير");

  // ===== العميل الثالث: خالد الدوسري =====
  const client3 = await prisma.user.create({
    data: {
      email: "khalid@aldosari-group.com",
      password,
      name: "خالد الدوسري",
      role: "CLIENT",
      phone: "+966541112233",
    },
  });

  const company3 = await prisma.company.create({
    data: {
      name: "مجموعة الدوسري العقارية",
      commercialRegister: "CR-10003",
      sector: "عقارات",
      ownerId: client3.id,
    },
  });

  const project3 = await prisma.project.create({
    data: {
      name: "نظام إدارة العقارات",
      status: "ACTIVE",
      priority: "URGENT",
      clientId: client3.id,
      managerId: admin.id,
      startDate: new Date("2026-02-15"),
      endDate: new Date("2026-08-15"),
    },
  });

  await prisma.task.createMany({
    data: [
      { title: "تحليل متطلبات النظام", status: "DONE", priority: "HIGH", projectId: project3.id, assigneeId: admin.id },
      { title: "تصميم قاعدة البيانات", status: "DONE", priority: "HIGH", projectId: project3.id, assigneeId: admin.id },
      { title: "لوحة تحكم المالك", status: "IN_PROGRESS", priority: "URGENT", projectId: project3.id, assigneeId: admin.id },
      { title: "بوابة المستأجرين", status: "TODO", priority: "HIGH", projectId: project3.id },
      { title: "نظام الفواتير التلقائي", status: "TODO", priority: "HIGH", projectId: project3.id },
      { title: "تقارير وإحصائيات", status: "TODO", priority: "MEDIUM", projectId: project3.id },
    ],
  });

  // خدمتين مفردتين
  await prisma.service.create({
    data: {
      name: "تصوير عقارات احترافي",
      description: "تصوير 10 عقارات بجودة عالية مع تعديل",
      category: "تصوير",
      price: 8000,
      duration: 14,
      clientId: client3.id,
      status: "COMPLETED",
    },
  });

  await prisma.service.create({
    data: {
      name: "تحسين SEO للموقع العقاري",
      description: "تحسين محركات البحث وزيادة الظهور",
      category: "تسويق رقمي",
      price: 4000,
      duration: 30,
      clientId: client3.id,
      status: "IN_PROGRESS",
    },
  });

  // فاتورة للعميل الثالث
  const inv3 = await prisma.invoice.create({
    data: {
      invoiceNumber: "INV-C004",
      title: "نظام إدارة العقارات - دفعة مقدمة",
      subtotal: 50000,
      taxRate: 15,
      taxAmount: 7500,
      totalAmount: 57500,
      status: "OVERDUE",
      dueDate: new Date("2026-03-01"),
      companyId: company3.id,
      projectId: project3.id,
      clientId: client3.id,
      createdById: admin.id,
      items: {
        create: [
          { description: "تحليل وتصميم النظام", quantity: 1, unitPrice: 15000, total: 15000 },
          { description: "تطوير لوحة التحكم", quantity: 1, unitPrice: 20000, total: 20000 },
          { description: "بوابة المستأجرين", quantity: 1, unitPrice: 15000, total: 15000 },
        ],
      },
    },
  });

  await prisma.payment.create({
    data: { amount: 20000, method: "BANK_TRANSFER", referenceNumber: "TRF-C004", invoiceId: inv3.id, notes: "دفعة أولى" },
  });

  // تذكيرات
  await prisma.reminder.create({
    data: {
      title: "متابعة سداد فاتورة الدوسري",
      type: "CUSTOM",
      dueDate: new Date("2026-03-15"),
      priority: "CRITICAL",
      companyId: company3.id,
      clientId: client3.id,
      createdById: admin.id,
    },
  });

  console.log("✅ تم إنشاء العميل: خالد الدوسري + شركة + مشروع + 2 خدمة + فاتورة + تذكير");
  console.log("\n🎉 تم إنشاء 3 عملاء تجريبيين بنجاح مع كل البيانات المرتبطة!");
  console.log("كلمة المرور لجميع العملاء: 12345678");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => { prisma.$disconnect(); });

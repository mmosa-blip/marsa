import "dotenv/config";
import { PrismaClient, InvoiceStatus, PaymentMethod } from "../src/generated/prisma/client";
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
  // الحصول على الشركة والمستخدم الأول
  const company = await prisma.company.findFirst();
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });

  if (!company || !admin) {
    console.log("يرجى تشغيل seed-hr.ts أولاً لإنشاء الشركة والمستخدم");
    return;
  }

  const project = await prisma.project.findFirst();

  const invoicesData = [
    {
      invoiceNumber: "INV-0001",
      title: "تصميم الهوية البصرية",
      description: "تصميم شعار وهوية بصرية كاملة للشركة",
      subtotal: 8000,
      taxRate: 15,
      taxAmount: 1200,
      totalAmount: 9200,
      status: "PAID",
      dueDate: new Date("2026-02-15"),
      companyId: company.id,
      projectId: project?.id || null,
      createdById: admin.id,
      items: [
        { description: "تصميم الشعار", quantity: 1, unitPrice: 3000, total: 3000 },
        { description: "دليل الهوية البصرية", quantity: 1, unitPrice: 2500, total: 2500 },
        { description: "تصميم بطاقات العمل", quantity: 1, unitPrice: 1500, total: 1500 },
        { description: "تصميم الأوراق الرسمية", quantity: 1, unitPrice: 1000, total: 1000 },
      ],
      payments: [
        { amount: 5000, method: "BANK_TRANSFER", referenceNumber: "TRF-2026-001", paymentDate: new Date("2026-01-20"), notes: "دفعة أولى" },
        { amount: 4200, method: "BANK_TRANSFER", referenceNumber: "TRF-2026-002", paymentDate: new Date("2026-02-10"), notes: "دفعة نهائية" },
      ],
    },
    {
      invoiceNumber: "INV-0002",
      title: "تطوير موقع إلكتروني",
      description: "تطوير موقع إلكتروني متجاوب مع لوحة تحكم",
      subtotal: 25000,
      taxRate: 15,
      taxAmount: 3750,
      totalAmount: 28750,
      status: "SENT",
      dueDate: new Date("2026-04-01"),
      companyId: company.id,
      projectId: project?.id || null,
      createdById: admin.id,
      items: [
        { description: "تصميم واجهات المستخدم (UI/UX)", quantity: 1, unitPrice: 8000, total: 8000 },
        { description: "تطوير الواجهة الأمامية", quantity: 1, unitPrice: 10000, total: 10000 },
        { description: "تطوير الواجهة الخلفية وقاعدة البيانات", quantity: 1, unitPrice: 5000, total: 5000 },
        { description: "اختبار وضمان الجودة", quantity: 1, unitPrice: 2000, total: 2000 },
      ],
      payments: [
        { amount: 10000, method: "BANK_TRANSFER", referenceNumber: "TRF-2026-003", paymentDate: new Date("2026-03-01"), notes: "دفعة مقدمة" },
      ],
    },
    {
      invoiceNumber: "INV-0003",
      title: "استشارات تقنية",
      description: "جلسات استشارية لتحسين البنية التقنية",
      subtotal: 6000,
      taxRate: 15,
      taxAmount: 900,
      totalAmount: 6900,
      status: "OVERDUE",
      dueDate: new Date("2026-02-28"),
      companyId: company.id,
      createdById: admin.id,
      items: [
        { description: "جلسة استشارية (4 ساعات)", quantity: 3, unitPrice: 1500, total: 4500 },
        { description: "تقرير تحليلي مفصل", quantity: 1, unitPrice: 1500, total: 1500 },
      ],
      payments: [],
    },
    {
      invoiceNumber: "INV-0004",
      title: "صيانة شهرية - فبراير",
      description: "خدمات الصيانة والدعم الفني الشهرية",
      subtotal: 3000,
      taxRate: 15,
      taxAmount: 450,
      totalAmount: 3450,
      status: "DRAFT",
      dueDate: new Date("2026-03-30"),
      companyId: company.id,
      createdById: admin.id,
      items: [
        { description: "صيانة الخوادم", quantity: 1, unitPrice: 1200, total: 1200 },
        { description: "دعم فني عن بعد", quantity: 1, unitPrice: 800, total: 800 },
        { description: "تحديثات أمنية", quantity: 1, unitPrice: 1000, total: 1000 },
      ],
      payments: [],
    },
    {
      invoiceNumber: "INV-0005",
      title: "تطوير تطبيق جوال",
      description: "تطوير تطبيق جوال لنظامي iOS و Android",
      subtotal: 45000,
      taxRate: 15,
      taxAmount: 6750,
      totalAmount: 51750,
      status: "SENT",
      dueDate: new Date("2026-05-15"),
      companyId: company.id,
      projectId: project?.id || null,
      createdById: admin.id,
      items: [
        { description: "تصميم واجهات التطبيق", quantity: 1, unitPrice: 12000, total: 12000 },
        { description: "تطوير تطبيق iOS", quantity: 1, unitPrice: 15000, total: 15000 },
        { description: "تطوير تطبيق Android", quantity: 1, unitPrice: 15000, total: 15000 },
        { description: "ربط API والخدمات السحابية", quantity: 1, unitPrice: 3000, total: 3000 },
      ],
      payments: [
        { amount: 20000, method: "CREDIT_CARD", referenceNumber: "CC-2026-001", paymentDate: new Date("2026-03-05"), notes: "دفعة أولى 40%" },
      ],
    },
  ];

  for (const inv of invoicesData) {
    const { items, payments, ...invoiceData } = inv;
    const created = await prisma.invoice.create({
      data: {
        ...invoiceData,
        status: invoiceData.status as InvoiceStatus,
        items: { create: items },
      },
    });

    for (const payment of payments) {
      await prisma.payment.create({
        data: {
          ...payment,
          method: payment.method as PaymentMethod,
          invoiceId: created.id,
        },
      });
    }

    console.log(`✅ تم إنشاء الفاتورة: ${inv.invoiceNumber} - ${inv.title}`);
  }

  console.log("\n🎉 تم إنشاء 5 فواتير بنجاح مع البنود والمدفوعات!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => { prisma.$disconnect(); });

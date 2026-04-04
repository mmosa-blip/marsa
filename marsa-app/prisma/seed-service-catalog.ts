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
  // Get existing staff users (ADMIN, MANAGER, EXECUTOR)
  const staffUsers = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "MANAGER", "EXECUTOR"] } },
    select: { id: true, name: true, role: true },
  });

  if (staffUsers.length === 0) {
    console.log("لا يوجد موظفين. قم بتشغيل seed أولاً.");
    return;
  }

  console.log(`وُجد ${staffUsers.length} موظفين`);

  // ===== الفئة 1: خدمات حكومية (أزرق) =====
  const govCategory = await prisma.serviceCategory.create({
    data: {
      name: "خدمات حكومية",
      description: "خدمات التعامل مع الجهات الحكومية والتراخيص",
      color: "#3B82F6",
      icon: "Building2",
      sortOrder: 0,
    },
  });

  // خدمة 1: إصدار/تجديد سجل تجاري
  const svc1 = await prisma.serviceTemplate.create({
    data: {
      name: "إصدار/تجديد سجل تجاري",
      description: "إصدار أو تجديد السجل التجاري لدى وزارة التجارة",
      defaultPrice: 1500,
      defaultDuration: 5,
      workflowType: "SEQUENTIAL",
      categoryId: govCategory.id,
      sortOrder: 0,
    },
  });

  await prisma.taskTemplate.createMany({
    data: [
      { name: "مراجعة المستندات", description: "مراجعة جميع المستندات المطلوبة والتأكد من اكتمالها", defaultDuration: 1, sortOrder: 0, isRequired: true, serviceTemplateId: svc1.id },
      { name: "تقديم الطلب إلكترونياً", description: "تقديم طلب الإصدار/التجديد عبر منصة وزارة التجارة", defaultDuration: 1, sortOrder: 1, isRequired: true, serviceTemplateId: svc1.id },
      { name: "متابعة الطلب", description: "متابعة حالة الطلب والرد على أي ملاحظات", defaultDuration: 2, sortOrder: 2, isRequired: true, serviceTemplateId: svc1.id },
      { name: "استلام وتسليم", description: "استلام السجل التجاري وتسليمه للعميل", defaultDuration: 1, sortOrder: 3, isRequired: true, serviceTemplateId: svc1.id },
    ],
  });

  // خدمة 2: تجديد رخصة بلدية
  const svc2 = await prisma.serviceTemplate.create({
    data: {
      name: "تجديد رخصة بلدية",
      description: "تجديد الرخصة البلدية لدى الأمانة/البلدية المختصة",
      defaultPrice: 2000,
      defaultDuration: 7,
      workflowType: "SEQUENTIAL",
      categoryId: govCategory.id,
      sortOrder: 1,
    },
  });

  await prisma.taskTemplate.createMany({
    data: [
      { name: "تجهيز ملف الرخصة", defaultDuration: 1, sortOrder: 0, isRequired: true, serviceTemplateId: svc2.id },
      { name: "زيارة البلدية وتقديم الطلب", defaultDuration: 1, sortOrder: 1, isRequired: true, serviceTemplateId: svc2.id },
      { name: "سداد الرسوم", defaultDuration: 1, sortOrder: 2, isRequired: true, serviceTemplateId: svc2.id },
      { name: "استلام الرخصة المجددة", defaultDuration: 2, sortOrder: 3, isRequired: true, serviceTemplateId: svc2.id },
      { name: "تحديث البيانات في النظام", defaultDuration: 1, sortOrder: 4, isRequired: false, serviceTemplateId: svc2.id },
    ],
  });

  // خدمة 3: إصدار شهادة زكاة
  const svc3 = await prisma.serviceTemplate.create({
    data: {
      name: "إصدار شهادة زكاة",
      description: "إصدار شهادة الزكاة والدخل من هيئة الزكاة",
      defaultPrice: 800,
      defaultDuration: 3,
      workflowType: "SEQUENTIAL",
      categoryId: govCategory.id,
      sortOrder: 2,
    },
  });

  await prisma.taskTemplate.createMany({
    data: [
      { name: "مراجعة الإقرارات المالية", defaultDuration: 1, sortOrder: 0, isRequired: true, serviceTemplateId: svc3.id },
      { name: "تقديم الطلب إلكترونياً", defaultDuration: 1, sortOrder: 1, isRequired: true, serviceTemplateId: svc3.id },
      { name: "استلام الشهادة", defaultDuration: 1, sortOrder: 2, isRequired: true, serviceTemplateId: svc3.id },
    ],
  });

  // ===== الفئة 2: خدمات محاسبية (أخضر) =====
  const accCategory = await prisma.serviceCategory.create({
    data: {
      name: "خدمات محاسبية",
      description: "خدمات المحاسبة والتقارير المالية والإقرارات الضريبية",
      color: "#10B981",
      icon: "Calculator",
      sortOrder: 1,
    },
  });

  // خدمة 4: إعداد القوائم المالية
  const svc4 = await prisma.serviceTemplate.create({
    data: {
      name: "إعداد القوائم المالية",
      description: "إعداد القوائم المالية الشاملة (ميزانية، دخل، تدفقات نقدية)",
      defaultPrice: 5000,
      defaultDuration: 14,
      workflowType: "INDEPENDENT",
      categoryId: accCategory.id,
      sortOrder: 0,
    },
  });

  await prisma.taskTemplate.createMany({
    data: [
      { name: "جمع البيانات المالية", defaultDuration: 3, sortOrder: 0, isRequired: true, serviceTemplateId: svc4.id },
      { name: "إعداد الميزانية العمومية", defaultDuration: 4, sortOrder: 1, isRequired: true, serviceTemplateId: svc4.id },
      { name: "إعداد قائمة الدخل", defaultDuration: 3, sortOrder: 2, isRequired: true, serviceTemplateId: svc4.id },
      { name: "إعداد قائمة التدفقات النقدية", defaultDuration: 3, sortOrder: 3, isRequired: true, serviceTemplateId: svc4.id },
      { name: "المراجعة النهائية", defaultDuration: 2, sortOrder: 4, isRequired: true, serviceTemplateId: svc4.id },
    ],
  });

  // خدمة 5: تقديم إقرار ضريبي
  const svc5 = await prisma.serviceTemplate.create({
    data: {
      name: "تقديم إقرار ضريبي",
      description: "تقديم إقرار ضريبة القيمة المضافة لهيئة الزكاة والضريبة",
      defaultPrice: 3000,
      defaultDuration: 5,
      workflowType: "SEQUENTIAL",
      categoryId: accCategory.id,
      sortOrder: 1,
    },
  });

  await prisma.taskTemplate.createMany({
    data: [
      { name: "جمع فواتير الشراء والبيع", defaultDuration: 1, sortOrder: 0, isRequired: true, serviceTemplateId: svc5.id },
      { name: "حساب الضريبة المستحقة", defaultDuration: 1, sortOrder: 1, isRequired: true, serviceTemplateId: svc5.id },
      { name: "تقديم الإقرار إلكترونياً", defaultDuration: 1, sortOrder: 2, isRequired: true, serviceTemplateId: svc5.id },
      { name: "سداد المبلغ المستحق", defaultDuration: 1, sortOrder: 3, isRequired: true, serviceTemplateId: svc5.id },
      { name: "حفظ الإيصالات", defaultDuration: 1, sortOrder: 4, isRequired: false, serviceTemplateId: svc5.id },
    ],
  });

  // ===== الفئة 3: خدمات موارد بشرية (بنفسجي) =====
  const hrCategory = await prisma.serviceCategory.create({
    data: {
      name: "خدمات موارد بشرية",
      description: "خدمات إدارة شؤون العمالة والتأشيرات والإقامات",
      color: "#8B5CF6",
      icon: "UserCog",
      sortOrder: 2,
    },
  });

  // خدمة 6: نقل كفالة
  const svc6 = await prisma.serviceTemplate.create({
    data: {
      name: "نقل كفالة",
      description: "نقل كفالة عامل من كفيل لآخر عبر منصة قوى",
      defaultPrice: 1200,
      defaultDuration: 10,
      workflowType: "SEQUENTIAL",
      categoryId: hrCategory.id,
      sortOrder: 0,
    },
  });

  await prisma.taskTemplate.createMany({
    data: [
      { name: "تجهيز مستندات النقل", defaultDuration: 1, sortOrder: 0, isRequired: true, serviceTemplateId: svc6.id },
      { name: "تقديم طلب النقل إلكترونياً", defaultDuration: 1, sortOrder: 1, isRequired: true, serviceTemplateId: svc6.id },
      { name: "موافقة الكفيل الحالي", defaultDuration: 3, sortOrder: 2, isRequired: true, serviceTemplateId: svc6.id },
      { name: "سداد رسوم النقل", defaultDuration: 1, sortOrder: 3, isRequired: true, serviceTemplateId: svc6.id },
      { name: "تحديث بيانات الإقامة", defaultDuration: 2, sortOrder: 4, isRequired: true, serviceTemplateId: svc6.id },
      { name: "استلام الإقامة المحدثة", defaultDuration: 2, sortOrder: 5, isRequired: true, serviceTemplateId: svc6.id },
    ],
  });

  // خدمة 7: تجديد إقامة
  const svc7 = await prisma.serviceTemplate.create({
    data: {
      name: "تجديد إقامة",
      description: "تجديد تصريح الإقامة للعمالة عبر منصة أبشر",
      defaultPrice: 500,
      defaultDuration: 5,
      workflowType: "SEQUENTIAL",
      categoryId: hrCategory.id,
      sortOrder: 1,
    },
  });

  await prisma.taskTemplate.createMany({
    data: [
      { name: "التأكد من صلاحية التأمين", defaultDuration: 1, sortOrder: 0, isRequired: true, serviceTemplateId: svc7.id },
      { name: "سداد رسوم التجديد", defaultDuration: 1, sortOrder: 1, isRequired: true, serviceTemplateId: svc7.id },
      { name: "تقديم طلب التجديد", defaultDuration: 1, sortOrder: 2, isRequired: true, serviceTemplateId: svc7.id },
      { name: "استلام الإقامة المجددة", defaultDuration: 2, sortOrder: 3, isRequired: true, serviceTemplateId: svc7.id },
    ],
  });

  // ===== الفئة 4: خدمات قانونية (برتقالي) =====
  const legalCategory = await prisma.serviceCategory.create({
    data: {
      name: "خدمات قانونية",
      description: "خدمات الاستشارات القانونية وصياغة العقود",
      color: "#F97316",
      icon: "Scale",
      sortOrder: 3,
    },
  });

  // خدمة 8: صياغة عقد
  const svc8 = await prisma.serviceTemplate.create({
    data: {
      name: "صياغة عقد",
      description: "صياغة ومراجعة عقود تجارية وعمالية",
      defaultPrice: 3500,
      defaultDuration: 7,
      workflowType: "INDEPENDENT",
      categoryId: legalCategory.id,
      sortOrder: 0,
    },
  });

  await prisma.taskTemplate.createMany({
    data: [
      { name: "دراسة متطلبات العقد", defaultDuration: 2, sortOrder: 0, isRequired: true, serviceTemplateId: svc8.id },
      { name: "صياغة المسودة الأولى", defaultDuration: 3, sortOrder: 1, isRequired: true, serviceTemplateId: svc8.id },
      { name: "مراجعة العميل والتعديل", defaultDuration: 2, sortOrder: 2, isRequired: true, serviceTemplateId: svc8.id },
      { name: "إصدار النسخة النهائية", defaultDuration: 1, sortOrder: 3, isRequired: true, serviceTemplateId: svc8.id },
    ],
  });

  // ===== ربط الموظفين المؤهلين بالخدمات =====
  const allTemplates = [svc1, svc2, svc3, svc4, svc5, svc6, svc7, svc8];

  for (const template of allTemplates) {
    // Assign 3-4 employees to each template (round-robin from available staff)
    const count = Math.min(staffUsers.length, Math.floor(Math.random() * 2) + 3);
    const shuffled = [...staffUsers].sort(() => Math.random() - 0.5).slice(0, count);

    for (const user of shuffled) {
      await prisma.serviceTemplateEmployee.create({
        data: {
          serviceTemplateId: template.id,
          userId: user.id,
        },
      }).catch(() => {}); // Skip duplicates
    }
  }

  console.log("✅ تم إنشاء بيانات كتالوج الخدمات بنجاح!");
  console.log(`   - 4 فئات`);
  console.log(`   - 8 خدمات`);
  console.log(`   - ${await prisma.taskTemplate.count()} مهمة قالب`);
  console.log(`   - ${await prisma.serviceTemplateEmployee.count()} ربط موظف`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

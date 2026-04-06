/**
 * Seed the complete "مشروع الاستحواذ على الشركة الأجنبية" project template
 * for قسم الاستثمار. Based on full spec from الاستثمار الخدمي.docx
 *
 * Structure: 6 main phases + background tasks + optional branch phase
 * Total: 62 tasks across 7 phases
 *
 * NOTE: Special features (round-robin, AI verification, warnings, expiry tracking)
 * are NOT implemented here — this is the template structure only.
 */
import { createScriptPrisma } from "./db";

// ─── Phase definitions ─────────────────────────────
const PHASES: { name: string; description: string; tasks: string[] }[] = [
  {
    name: "المرحلة 1: الاستحواذ على الشركة الأجنبية",
    description: "الإجراءات الأساسية للاستحواذ على الشركة الأجنبية",
    tasks: [
      "رفع المستندات (مستندات ورقية ونصوص)",
      "رفع المعلومات للمورد الخارجي — مهمة حساسة تسند لشخص محدد",
      "متابعة إنجاز الاستحواذ يومياً",
      "استلام وثيقة الاستحواذ الأولي (PDF) ومطابقة: اسم الشركة، أسماء الشركاء، نسب الشراكة، الأنشطة",
      "مراجعة الذكاء الاصطناعي للمطابقة وتنبيه المنفذ إن وجد خطأ",
      "بناء ملف وكالة وترجمتها",
      "مراجعة ملف الوكالة والترجمة — لنفس المنفذ الذي بناها",
      "مراجعة إضافية لملف الوكالة — لمنفذ مختلف عن الذي بناها",
      "مراجعة الذكاء الاصطناعي الإضافية للوكالة والترجمة",
      "إرسال الملفات للمورد الخارجي للتصديق",
      "متابعة إنجاز التصديق من قبل المورد",
      "استلام PDF يحتوي: عقد التأسيس، القوائم المالية، الوكالة، الترجمة",
      "مطابقة الأوراق مع المستندات الرسمية والمعلومات السابقة",
      "مراجعة الذكاء الاصطناعي للمطابقة النهائية",
      "تصديق المستندات من وزارة العدل",
      "أرشفة المستندات إلكترونياً",
    ],
  },
  {
    name: "المرحلة 1 (مهام خلفية): شحن وأرشفة المستندات الورقية",
    description: "مهام خلفية متوازية لا توقف المهام الرئيسية",
    tasks: [
      "متابعة شحن المورد للمستندات الورقية",
      "متابعة وصول الشحنة إلى العنوان",
      "استلام الشحنة من شركة الشحن",
      "مطابقة المستندات الورقية مع المستندات الرسمية",
      "أرشفة الملفات الورقية",
    ],
  },
  {
    name: "المرحلة 1 (اختيارية): فتح فرع للشركة",
    description: "مهام إضافية عند الحاجة لفتح فرع — تتكرر بعدد الفروع",
    tasks: [
      "رفع مستندات الفرع الجديد",
      "رفع المعلومات للمحامي (مورد خارجي) — مهمة حساسة",
      "متابعة تأسيس الفرع الجديد يومياً",
      "استلام PDF للفرع: عقد التأسيس، القوائم المالية، الوكالة، الترجمة",
      "مطابقة مع المستندات الرسمية وملفات الشركة الأم",
      "تصديق مستندات الفرع من وزارة العدل",
      "أرشفة مستندات الفرع إلكترونياً",
      "متابعة شحن مستندات الفرع الورقية",
      "متابعة وصول شحنة الفرع",
      "استلام شحنة الفرع من شركة الشحن",
      "مطابقة الملفات الورقية للفرع",
      "أرشفة الملفات الورقية للفرع",
    ],
  },
  {
    name: "المرحلة 2: إجراءات وزارة الاستثمار",
    description: "التسجيل في وزارة الاستثمار والحصول على رخصة الاستثمار",
    tasks: [
      "إنشاء بريد إلكتروني على أوتلوك",
      "حفظ بيانات البريد الإلكتروني في النظام (أرشفة)",
      "إنشاء حساب مستخدم في وزارة الاستثمار",
      "حفظ بيانات حساب وزارة الاستثمار (أرشفة)",
      "طلب الحصول على رخصة الاستثمار",
      "إصدار رخصة الاستثمار",
      "استلام رخصة الاستثمار وتقييد تاريخ الانتهاء في النظام",
    ],
  },
  {
    name: "المرحلة 3: إجراءات تأسيس الشركة السعودية",
    description: "تأسيس الشركة السعودية وحجز الاسم التجاري",
    tasks: [
      "طلب الاسم التجاري من العميل",
      "حجز الاسم التجاري",
      "متابعة قبول الاسم التجاري",
      "دفع رسوم حجز الاسم التجاري",
      "تقديم طلب لتأسيس شركة سعودية",
      "متابعة قبول تأسيس الشركة السعودية",
      "رفع عقد تأسيس الشركة السعودية + تقييد تاريخ الانتهاء",
    ],
  },
  {
    name: "المرحلة 4: إجراءات وزارة التجارة",
    description: "تسجيل الشركة في وزارة التجارة",
    tasks: [
      "تجهيز ملف الاستثمار",
      "رفع المستندات اللازمة في وزارة التجارة",
      "إصدار فاتورة السداد",
      "سداد رسوم تأسيس الشركة السعودية",
    ],
  },
  {
    name: "المرحلة 5: الاشتراك في المنصات الحكومية",
    description: "تسجيل الشركة في المنصات الحكومية الإلزامية",
    tasks: [
      "الاشتراك في منصة قوى",
      "إنشاء حساب مستخدم في منصة مقيم",
      "الاشتراك في منصة مقيم",
      "دفع رسوم منصة مدد",
      "استخراج شهادة الضريبة",
      "استخراج العنوان الوطني",
      "إنشاء حساب مستخدم في الغرفة التجارية",
    ],
  },
  {
    name: "المرحلة 6: تسليم المستندات",
    description: "تسليم المستندات النهائية للعميل — تنفذ من قبل منفذ واحد",
    tasks: [
      "تجهيز ورقة تسليم ليوقع العميل عليها",
      "توقيع ورقة التسليم من العميل",
      "تسليم المستندات للعميل",
      "أرشفة ورقة التسليم",
    ],
  },
];

async function main() {
  const prisma = createScriptPrisma();

  // 1) Find Investment department
  const dept = await prisma.department.findFirst({
    where: { name: { contains: "الاستثمار" } },
    select: { id: true, name: true },
  });
  if (!dept) {
    console.error("❌ قسم الاستثمار غير موجود");
    await prisma.$disconnect();
    return;
  }
  console.log(`✓ Department: ${dept.name} (${dept.id})`);

  // 2) Find or create "مشاريع الاستحواذ" category
  let category = await prisma.serviceCategory.findFirst({
    where: { name: "مشاريع الاستحواذ" },
  });
  if (!category) {
    category = await prisma.serviceCategory.create({
      data: {
        name: "مشاريع الاستحواذ",
        description: "مشاريع الاستحواذ على الشركات الأجنبية",
        sortOrder: 0,
      },
    });
    console.log(`✓ Created category: مشاريع الاستحواذ`);
  } else {
    console.log(`✓ Category exists: مشاريع الاستحواذ`);
  }

  // 3) Delete existing template
  const templateName = "مشروع الاستحواذ على الشركة الأجنبية";
  const existing = await prisma.projectTemplate.findFirst({
    where: { name: templateName },
  });
  if (existing) {
    console.log(`\n⚠️  Template exists — deleting old version...`);
    await prisma.projectTemplateService.deleteMany({
      where: { projectTemplateId: existing.id },
    });
    await prisma.projectTemplate.delete({ where: { id: existing.id } });
  }

  // Clean up orphan service templates with our phase names
  console.log(`🧹 Cleaning up old service templates...`);
  const phaseNames = PHASES.map((p) => p.name);
  for (const name of phaseNames) {
    const stList = await prisma.serviceTemplate.findMany({
      where: { categoryId: category.id, name },
      select: { id: true },
    });
    for (const st of stList) {
      await prisma.taskTemplate.deleteMany({ where: { serviceTemplateId: st.id } });
      await prisma.projectTemplateService.deleteMany({ where: { serviceTemplateId: st.id } });
      await prisma.serviceTemplateEmployee.deleteMany({ where: { serviceTemplateId: st.id } }).catch(() => {});
      await prisma.serviceTemplateEscalation.deleteMany({ where: { serviceTemplateId: st.id } }).catch(() => {});
      await prisma.serviceTemplate.delete({ where: { id: st.id } }).catch(() => {});
    }
  }
  console.log(`   Cleanup done.`);

  // 4) Create project template
  const template = await prisma.projectTemplate.create({
    data: {
      name: templateName,
      description: "قالب كامل لمشاريع الاستحواذ على الشركات الأجنبية — 8 مراحل مع مهام الفرع الاختيارية والمهام الخلفية",
      workflowType: "SEQUENTIAL",
      isSystem: true,
      isActive: true,
    },
  });
  console.log(`\n✓ Created template: ${templateName}`);

  // 5) Create phases and tasks
  let totalTasks = 0;
  for (let phaseIdx = 0; phaseIdx < PHASES.length; phaseIdx++) {
    const phase = PHASES[phaseIdx];

    const serviceTemplate = await prisma.serviceTemplate.create({
      data: {
        name: phase.name,
        description: phase.description,
        categoryId: category.id,
        departmentId: dept.id,
        workflowType: "SEQUENTIAL",
        isActive: true,
        sortOrder: phaseIdx,
      },
    });

    await prisma.projectTemplateService.create({
      data: {
        projectTemplateId: template.id,
        serviceTemplateId: serviceTemplate.id,
        sortOrder: phaseIdx,
      },
    });

    console.log(`\n  📋 [${phaseIdx + 1}] ${phase.name}  (${phase.tasks.length} مهمة)`);

    for (let i = 0; i < phase.tasks.length; i++) {
      await prisma.taskTemplate.create({
        data: {
          name: phase.tasks[i],
          description: null,
          defaultDuration: 1,
          sortOrder: i,
          executionMode: "SEQUENTIAL",
          sameDay: false,
          isRequired: true,
          serviceTemplateId: serviceTemplate.id,
        },
      });
      totalTasks++;
    }
  }

  console.log(`\n✅ Template "${templateName}" created successfully.`);
  console.log(`   📊 Total: ${PHASES.length} phases, ${totalTasks} tasks`);
  console.log(`\n📝 Note: Special features (AI, warnings, round-robin) must be implemented separately.`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

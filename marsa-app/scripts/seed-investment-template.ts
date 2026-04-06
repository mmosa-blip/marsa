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
import { createPool } from "mariadb";
import { randomUUID } from "crypto";

function cuid(): string {
  return "cm" + randomUUID().replace(/-/g, "").slice(0, 22);
}

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
  const pool = createPool({
    host: "srv502.hstgr.io",
    port: 3306,
    user: "u102183221_mohammed",
    password: "Marsa2026",
    database: "u102183221_mrsa",
    connectionLimit: 1,
  });

  const conn = await pool.getConnection();

  // 1) Find Investment department
  const depts = await conn.query("SELECT id, name FROM departments WHERE name LIKE '%الاستثمار%'");
  if (depts.length === 0) {
    console.error("❌ قسم الاستثمار غير موجود");
    conn.release();
    await pool.end();
    return;
  }
  const deptId = depts[0].id;
  console.log(`✓ Department: ${depts[0].name} (${deptId})`);

  // 2) Find or create "مشاريع الاستحواذ" category
  const catRows = await conn.query("SELECT id FROM service_categories WHERE name = 'مشاريع الاستحواذ'");
  let categoryId: string;
  if (catRows.length === 0) {
    categoryId = cuid();
    await conn.query(
      "INSERT INTO service_categories (id, name, description, sortOrder, isActive, isPublic, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [categoryId, "مشاريع الاستحواذ", "مشاريع الاستحواذ على الشركات الأجنبية", 0, true, true, new Date()]
    );
    console.log(`✓ Created category: مشاريع الاستحواذ`);
  } else {
    categoryId = catRows[0].id;
    console.log(`✓ Category exists: مشاريع الاستحواذ`);
  }

  // 3) Delete existing template if present, and any orphan service templates in this category
  const templateName = "مشروع الاستحواذ على الشركة الأجنبية";
  const existing = await conn.query("SELECT id FROM project_templates WHERE name = ?", [templateName]);
  if (existing.length > 0) {
    console.log(`\n⚠️  Template exists — deleting old version...`);
    const oldTemplateId = existing[0].id;
    await conn.query("DELETE FROM project_template_services WHERE projectTemplateId = ?", [oldTemplateId]);
    await conn.query("DELETE FROM project_templates WHERE id = ?", [oldTemplateId]);
  }

  // Clean up ALL service templates in this category that match our phase names (including orphans)
  console.log(`🧹 Cleaning up old service templates in category...`);
  const phaseNames = PHASES.map((p) => p.name);
  for (const name of phaseNames) {
    const stRows = await conn.query("SELECT id FROM service_templates WHERE categoryId = ? AND name = ?", [categoryId, name]);
    for (const st of stRows) {
      await conn.query("DELETE FROM task_templates WHERE serviceTemplateId = ?", [st.id]);
      await conn.query("DELETE FROM project_template_services WHERE serviceTemplateId = ?", [st.id]);
      await conn.query("DELETE FROM service_template_employees WHERE serviceTemplateId = ?", [st.id]).catch(() => {});
      await conn.query("DELETE FROM service_template_escalations WHERE serviceTemplateId = ?", [st.id]).catch(() => {});
      await conn.query("DELETE FROM service_templates WHERE id = ?", [st.id]);
    }
  }
  console.log(`   Cleanup done.`);

  // 4) Create project template
  const templateId = cuid();
  const now = new Date();
  await conn.query(
    "INSERT INTO project_templates (id, name, description, workflowType, isSystem, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [
      templateId,
      templateName,
      "قالب كامل لمشاريع الاستحواذ على الشركات الأجنبية — 7 مراحل شاملة مع مهام الفرع الاختيارية والمهام الخلفية",
      "SEQUENTIAL",
      true,
      true,
      now,
      now,
    ]
  );
  console.log(`\n✓ Created template: ${templateName}`);

  // 5) Create each phase as service template with task templates
  let totalTasks = 0;
  for (let phaseIdx = 0; phaseIdx < PHASES.length; phaseIdx++) {
    const phase = PHASES[phaseIdx];

    const serviceTemplateId = cuid();
    await conn.query(
      `INSERT INTO service_templates
       (id, name, description, categoryId, departmentId, workflowType, isActive, sortOrder, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        serviceTemplateId,
        phase.name,
        phase.description,
        categoryId,
        deptId,
        "SEQUENTIAL",
        true,
        phaseIdx,
        now,
        now,
      ]
    );

    // Link service template to project template
    await conn.query(
      "INSERT INTO project_template_services (id, projectTemplateId, serviceTemplateId, sortOrder) VALUES (?, ?, ?, ?)",
      [cuid(), templateId, serviceTemplateId, phaseIdx]
    );

    console.log(`\n  📋 [${phaseIdx + 1}] ${phase.name}  (${phase.tasks.length} مهمة)`);

    for (let i = 0; i < phase.tasks.length; i++) {
      await conn.query(
        `INSERT INTO task_templates
         (id, name, description, defaultDuration, sortOrder, executionMode, sameDay, isRequired, serviceTemplateId, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [cuid(), phase.tasks[i], null, 1, i, "SEQUENTIAL", false, true, serviceTemplateId, now]
      );
      totalTasks++;
    }
  }

  console.log(`\n✅ Template "${templateName}" created successfully.`);
  console.log(`   📊 Total: ${PHASES.length} phases, ${totalTasks} tasks`);
  console.log(`\n📝 Note: Special features (AI, warnings, expiry tracking, round-robin) must be implemented separately.`);

  conn.release();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

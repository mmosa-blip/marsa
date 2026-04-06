/**
 * Seed the "مشروع الاستحواذ على الشركة الأجنبية" project template
 * for the Investment department (قسم الاستثمار).
 *
 * NOTE: The spec provided was partially truncated. This script creates:
 * - Phase 6: تسليم المستندات — 4 tasks (COMPLETE from spec)
 * - Phase 1: الاستحواذ على الشركة الأجنبية — placeholder (spec cut off)
 * - A phase with tasks 3-7 (EXPIRY_DATE/مدد/ضريبة/عنوان وطني/غرفة تجارية)
 *
 * Phases 2-5 and missing tasks in Phase 1 should be added via the UI.
 */
import { createPool } from "mariadb";
import { randomUUID } from "crypto";

function cuid(): string {
  return "cm" + randomUUID().replace(/-/g, "").slice(0, 22);
}

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

  // 2) Find or create "مشاريع الاستحواذ" service category
  const catRows = await conn.query("SELECT id FROM service_categories WHERE name = 'مشاريع الاستحواذ'");
  let categoryId: string;
  if (catRows.length === 0) {
    categoryId = cuid();
    const nowCat = new Date();
    await conn.query(
      "INSERT INTO service_categories (id, name, description, sortOrder, isActive, isPublic, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [categoryId, "مشاريع الاستحواذ", "مشاريع الاستحواذ على الشركات الأجنبية", 0, true, true, nowCat]
    );
    console.log(`✓ Created category: مشاريع الاستحواذ (${categoryId})`);
  } else {
    categoryId = catRows[0].id;
    console.log(`✓ Category: مشاريع الاستحواذ (${categoryId})`);
  }

  // 3) Define phases (service templates) with their tasks
  const phases: { name: string; description: string; tasks: string[] }[] = [
    {
      name: "المرحلة 1: الاستحواذ على الشركة الأجنبية",
      description: "الإجراءات الأولية للاستحواذ (تفاصيل المهام بانتظار المواصفات الكاملة)",
      tasks: [
        "استلام طلب الاستحواذ من العميل",
        "مراجعة بيانات الشركة الأجنبية",
        "التحقق من المتطلبات القانونية",
      ],
    },
    {
      name: "المرحلة 2: التسجيل الرسمي",
      description: "التسجيلات الحكومية المطلوبة",
      tasks: [
        "تسجيل في منصة قوى",
        "تسجيل في منصة مقيم",
        "دفع رسوم منصة مدد",
        "استخراج شهادة الضريبة",
        "استخراج العنوان الوطني",
        "إنشاء حساب مستخدم في الغرفة التجارية",
      ],
    },
    {
      name: "المرحلة 6: تسليم المستندات",
      description: "تسليم المستندات النهائية للعميل — تُنفذ من قبل منفذ واحد",
      tasks: [
        "تجهيز ورقة تسليم ليوقع العميل عليها",
        "توقيع ورقة التسليم من العميل",
        "تسليم المستندات للعميل",
        "أرشفة ورقة التسليم",
      ],
    },
  ];

  // 4) Create project template
  const templateName = "مشروع الاستحواذ على الشركة الأجنبية";
  const existing = await conn.query("SELECT id FROM project_templates WHERE name = ?", [templateName]);
  if (existing.length > 0) {
    console.log(`⚠️  Template "${templateName}" already exists. Deleting to recreate...`);
    // Delete linked project_template_services first
    await conn.query("DELETE FROM project_template_services WHERE projectTemplateId = ?", [existing[0].id]);
    await conn.query("DELETE FROM project_templates WHERE id = ?", [existing[0].id]);
  }

  const templateId = cuid();
  const now = new Date();
  await conn.query(
    "INSERT INTO project_templates (id, name, description, workflowType, isSystem, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [
      templateId,
      templateName,
      "قالب جاهز لمشاريع الاستحواذ على الشركات الأجنبية في قسم الاستثمار",
      "SEQUENTIAL",
      true,
      true,
      now,
      now,
    ]
  );
  console.log(`\n✓ Created template: ${templateName} (${templateId})`);

  // 5) Create service template (phase) and task templates for each phase
  let sortOrder = 0;
  for (const phase of phases) {
    // Create service template for this phase
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
        sortOrder,
        now,
        now,
      ]
    );
    console.log(`\n  📋 ${phase.name}`);

    // Link service template to project template
    const ptsId = cuid();
    await conn.query(
      "INSERT INTO project_template_services (id, projectTemplateId, serviceTemplateId, sortOrder) VALUES (?, ?, ?, ?)",
      [ptsId, templateId, serviceTemplateId, sortOrder]
    );

    // Create task templates
    for (let i = 0; i < phase.tasks.length; i++) {
      const taskId = cuid();
      await conn.query(
        `INSERT INTO task_templates
         (id, name, description, defaultDuration, sortOrder, executionMode, sameDay, isRequired, serviceTemplateId, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [taskId, phase.tasks[i], null, 1, i, "SEQUENTIAL", false, true, serviceTemplateId, now]
      );
      console.log(`     ${i + 1}. ${phase.tasks[i]}`);
    }

    sortOrder++;
  }

  console.log("\n✅ Investment project template created successfully.");
  console.log(`\n⚠️  IMPORTANT: The following was NOT included (spec was truncated):`);
  console.log(`    - Phases 3, 4, 5 — add via UI`);
  console.log(`    - Missing tasks in Phase 1 — add via UI`);
  console.log(`    - Expiry dates for Phase 2 tasks — add via UI`);

  conn.release();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

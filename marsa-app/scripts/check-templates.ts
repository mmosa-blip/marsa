import { createPool } from "mariadb";

async function main() {
  const pool = createPool({
    host: "srv502.hstgr.io", port: 3306,
    user: "u102183221_mohammed", password: "Marsa2026",
    database: "u102183221_mrsa", connectionLimit: 1,
  });
  const conn = await pool.getConnection();

  // Find قسم الخدمات department ID
  const depts = await conn.query("SELECT id, name FROM departments");
  console.log("=== DEPARTMENTS ===");
  for (const d of depts) console.log(`  ${d.name} (${d.id})`);

  const servicesDept = depts.find((d: { name: string }) => d.name.includes("الخدمات"));
  const keepDeptId = servicesDept?.id || "NONE";
  console.log(`\nKeeping data for: ${servicesDept?.name} (${keepDeptId})`);

  // Count what would be deleted
  const projectTemplates = await conn.query("SELECT COUNT(*) as cnt FROM project_templates");
  const serviceTemplates = await conn.query("SELECT COUNT(*) as cnt FROM service_templates");
  const serviceTemplatesKeep = await conn.query("SELECT COUNT(*) as cnt FROM service_templates WHERE departmentId = ?", [keepDeptId]);
  const taskTemplates = await conn.query("SELECT COUNT(*) as cnt FROM task_templates");
  const serviceCategories = await conn.query("SELECT COUNT(*) as cnt FROM service_categories");

  console.log("\n=== DATA TO DELETE ===");
  console.log(`Project templates: ${projectTemplates[0].cnt} (all)`);
  console.log(`Service templates: ${serviceTemplates[0].cnt} total, ${serviceTemplatesKeep[0].cnt} kept (قسم الخدمات), ${serviceTemplates[0].cnt - serviceTemplatesKeep[0].cnt} to delete`);
  console.log(`Task templates: ${taskTemplates[0].cnt} (linked to deleted service templates)`);
  console.log(`Service categories: ${serviceCategories[0].cnt}`);

  conn.release();
  await pool.end();
}

main().catch(console.error);

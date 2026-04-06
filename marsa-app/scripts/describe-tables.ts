import { createPool } from "mariadb";

async function main() {
  const pool = createPool({
    host: "srv502.hstgr.io", port: 3306,
    user: "u102183221_mohammed", password: "Marsa2026",
    database: "u102183221_mrsa", connectionLimit: 1,
  });
  const conn = await pool.getConnection();
  for (const t of ["service_categories", "service_templates", "task_templates", "project_templates", "project_template_services"]) {
    const rows = await conn.query(`DESCRIBE ${t}`);
    console.log(`${t}:`, rows.map((r: { Field: string }) => r.Field).join(", "));
  }
  conn.release();
  await pool.end();
}
main().catch(console.error);

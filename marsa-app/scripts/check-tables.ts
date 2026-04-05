import { createPool } from "mariadb";

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

  const tables = await conn.query("SHOW TABLES");
  const tableNames = tables.map((t: Record<string, string>) => Object.values(t)[0]);

  console.log("=== ALL TABLES ===");
  for (const t of tableNames) console.log(" ", t);

  console.log("\n=== KEY CHECKS ===");
  console.log("opportunities:", tableNames.includes("opportunities") ? "EXISTS" : "MISSING");
  console.log("opportunity_activities:", tableNames.includes("opportunity_activities") ? "EXISTS" : "MISSING");
  console.log("departments:", tableNames.includes("departments") ? "EXISTS" : "MISSING");

  if (tableNames.includes("departments")) {
    const depts = await conn.query("SELECT id, name FROM departments");
    console.log("\nDepartments:", depts.length);
    for (const d of depts) console.log(`  - ${d.name} (${d.id})`);
  }

  conn.release();
  await pool.end();
}

main().catch(console.error);

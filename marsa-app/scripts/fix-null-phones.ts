import "dotenv/config";
import { createPool } from "mariadb";

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL required");

  const url = new URL(dbUrl.replace("mysql://", "http://"));
  const pool = createPool({
    host: url.hostname,
    port: parseInt(url.port || "3306"),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1).split("?")[0],
    connectionLimit: 1,
  });

  const conn = await pool.getConnection();

  const rows = await conn.query("SELECT id, name, email FROM users WHERE phone IS NULL OR phone = ''");
  console.log(`Found ${rows.length} users with null phone`);

  for (let i = 0; i < rows.length; i++) {
    const tempPhone = `050000000${i + 1}`;
    await conn.query("UPDATE users SET phone = ? WHERE id = ?", [tempPhone, rows[i].id]);
    console.log(`  ✓ ${rows[i].name} (${rows[i].email}) → ${tempPhone}`);
  }

  console.log("Done.");
  conn.release();
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });

/**
 * Tests Supabase connection modes to determine which support
 * interactive transactions ($transaction with callback).
 */
import pg from "pg";

const poolerUrl = process.env.DATABASE_URL;
if (!poolerUrl) {
  console.log("DATABASE_URL not set");
  process.exit(1);
}

// Derive URLs for each mode
const directUrl = poolerUrl
  .replace(":6543", ":5432")
  .replace("?pgbouncer=true", "");

const sessionPoolerUrl = poolerUrl
  .replace(":6543", ":5432")
  .replace("?pgbouncer=true", "");

async function testConnection(label: string, url: string) {
  console.log(`\n=== ${label} ===`);
  const masked = url.replace(/:[^:@]+@/, ":[HIDDEN]@");
  console.log(`URL: ${masked}`);

  const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    console.log("  Connection: OK");

    // Simple query
    const r = await client.query("SELECT 1 as ok");
    console.log("  Simple query: OK", r.rows[0]);

    // Transaction test
    try {
      await client.query("BEGIN");
      await client.query("SELECT 1");
      await client.query("COMMIT");
      console.log("  Transaction (BEGIN/COMMIT): OK");
    } catch (err: unknown) {
      console.log("  Transaction (BEGIN/COMMIT): FAILED -", (err as Error).message?.slice(0, 150));
      try { await client.query("ROLLBACK"); } catch {}
    }

    // Prepared statement test (pgbouncer transaction mode blocks these)
    try {
      await client.query({ text: "SELECT $1::int as val", values: [42], name: "test_prepared" });
      console.log("  Prepared statement: OK");
    } catch (err: unknown) {
      console.log("  Prepared statement: FAILED -", (err as Error).message?.slice(0, 150));
    }
  } catch (err: unknown) {
    console.log("  Connection: FAILED -", (err as Error).message?.slice(0, 200));
  } finally {
    await client.end().catch(() => {});
  }
}

async function main() {
  console.log("Supabase Connection Mode Tester");
  console.log("================================");

  await testConnection("Test 1: Transaction Pooler (port 6543, pgbouncer=true)", poolerUrl);
  await testConnection("Test 2: Direct / Session Pooler (port 5432)", directUrl);

  console.log("\n================================");
  console.log("SUMMARY:");
  console.log("  Transaction Pooler (6543): used by runtime queries");
  console.log("  Direct/Session (5432): used by db push + migrations");
  console.log("  Prisma uses PrismaPg adapter which wraps raw pg —");
  console.log("  $transaction with interactive callbacks requires");
  console.log("  a connection that supports prepared statements +");
  console.log("  multi-statement transactions (port 5432 only).");
}

main();

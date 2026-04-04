/**
 * Environment Guard — prevents dangerous scripts from running on production
 *
 * Usage: import at the top of any dangerous script:
 *   import "./env-guard";
 *
 * Or run standalone:
 *   npx tsx scripts/env-guard.ts
 */

const DANGEROUS_PATTERNS = [
  "clear-db",
  "drop",
  "truncate",
  "deleteMany",
  "reset",
  "wipe",
];

function isProduction(): boolean {
  const url = process.env.DATABASE_URL || "";
  const nodeEnv = process.env.NODE_ENV || "";

  // Check for known production indicators
  if (nodeEnv === "production") return true;
  if (url.includes("hostingersite")) return true;
  if (url.includes("hstgr.io")) return true;
  if (url.includes("u102183221")) return true;

  return false;
}

function getCallerScript(): string {
  // Get the script that imported this module
  const stack = new Error().stack || "";
  const lines = stack.split("\n");
  for (const line of lines) {
    if (line.includes("seed") || line.includes("clear") || line.includes("reset") || line.includes("script")) {
      const match = line.match(/\((.+?):\d+:\d+\)/);
      if (match) return match[1];
    }
  }
  return process.argv[1] || "unknown";
}

if (isProduction()) {
  const caller = getCallerScript();
  const isDangerous = DANGEROUS_PATTERNS.some((p) => caller.toLowerCase().includes(p));

  if (isDangerous) {
    console.error("");
    console.error("⛔ ═══════════════════════════════════════════════════");
    console.error("⛔  BLOCKED: Dangerous script detected on PRODUCTION");
    console.error(`⛔  Script: ${caller}`);
    console.error("⛔  This script could destroy production data.");
    console.error("⛔  If you REALLY need to run this, use NODE_ENV=development");
    console.error("⛔ ═══════════════════════════════════════════════════");
    console.error("");
    process.exit(1);
  } else {
    console.warn(`⚠️  Running on PRODUCTION database. Script: ${caller}`);
    console.warn("   Proceeding with caution...");
  }
}

export { isProduction };

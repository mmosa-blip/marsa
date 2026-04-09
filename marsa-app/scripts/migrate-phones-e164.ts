/**
 * One-off migration: convert every User.phone from the legacy Saudi
 * local format (05xxxxxxxx) to canonical E.164 (+9665xxxxxxxx).
 *
 * Safe to run multiple times — rows already in E.164 (starting with "+")
 * are skipped.
 *
 * Usage:
 *   npx tsx --env-file=.env.production scripts/migrate-phones-e164.ts
 */
import { createScriptPrisma } from "./db";

async function main() {
  const prisma = createScriptPrisma();
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, phone: true },
    });

    let migrated = 0;
    let already = 0;
    let skipped = 0;

    for (const u of users) {
      const p = u.phone?.trim() || "";
      if (!p) {
        skipped++;
        continue;
      }
      if (p.startsWith("+")) {
        already++;
        continue;
      }
      let next: string | null = null;
      if (/^05\d{8}$/.test(p)) next = "+966" + p.slice(1);
      else if (/^5\d{8}$/.test(p)) next = "+966" + p;
      else if (/^9665\d{8}$/.test(p)) next = "+" + p;
      else if (p.startsWith("00")) next = "+" + p.slice(2);

      if (!next) {
        console.log(`SKIP (unknown shape): ${u.name} — ${p}`);
        skipped++;
        continue;
      }

      await prisma.user.update({ where: { id: u.id }, data: { phone: next } });
      console.log(`✓ ${u.name}: ${p} → ${next}`);
      migrated++;
    }

    console.log("");
    console.log(
      `Done. migrated=${migrated}, already_e164=${already}, skipped=${skipped}, total=${users.length}`
    );
  } finally {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).$disconnect?.();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

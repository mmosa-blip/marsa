import "dotenv/config";

(async () => {
  const { prisma } = await import("../src/lib/prisma");

  console.log("=== DB snapshot ===");
  const total = await prisma.user.count();
  const notSoftDeleted = await prisma.user.count({ where: { deletedAt: null } });
  const active = await prisma.user.count({ where: { deletedAt: null, isActive: true } });
  console.log("user.count():", total);
  console.log("count({ deletedAt: null }):", notSoftDeleted, "  ← what /api/users counts");
  console.log("count({ deletedAt: null, isActive: true }):", active);

  console.log("\n=== ما الذي يرجعه /api/users فعلياً (محاكاة GET) ===");
  // What the API actually does with default page=1 take=50
  const where: Record<string, unknown> = { deletedAt: null };
  const [users, count] = await Promise.all([
    prisma.user.findMany({
      where,
      select: { id: true, name: true, role: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 50,
      skip: 0,
    }),
    prisma.user.count({ where }),
  ]);
  console.log(`returned page-1 of 50:  ${users.length} rows`);
  console.log(`total matching deletedAt=null:  ${count}`);
  console.log(`hidden behind page 1:  ${count - users.length}`);

  console.log("\n=== هل هناك createdAt متطابق (يكسر استقرار الترتيب)؟ ===");
  const all = await prisma.user.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, role: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  const tsMap = new Map<string, string[]>();
  for (const u of all) {
    const k = u.createdAt.toISOString();
    const arr = tsMap.get(k) ?? [];
    arr.push(`${u.role}:${u.name}`);
    tsMap.set(k, arr);
  }
  const dups = [...tsMap.entries()].filter(([, list]) => list.length > 1);
  console.log(`unique createdAt timestamps: ${tsMap.size}`);
  console.log(`duplicate createdAt buckets:  ${dups.length}`);
  for (const [ts, list] of dups.slice(0, 5)) {
    console.log(`  ${ts}: ${list.length} users  →  ${list.join(", ")}`);
  }

  console.log("\n=== الـ50 user الذين تَرجعهم API (الأحدث أولاً) ===");
  const last5 = users.slice(-5);
  console.log("آخر 5 ضمن النافذة:");
  for (const u of last5) {
    console.log(`  ${u.createdAt.toISOString()}  ${u.role.padEnd(18)}  ${u.name}`);
  }

  console.log("\n=== الذين خارج النافذة (مخفيون عن الصفحة) ===");
  const hidden = all.slice(50);
  console.log(`عدد المخفيين: ${hidden.length}`);
  for (const u of hidden.slice(0, 10)) {
    console.log(`  ${u.createdAt.toISOString()}  ${u.role.padEnd(18)}  ${u.name}`);
  }

  await prisma.$disconnect();
})();

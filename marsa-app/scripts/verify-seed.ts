import { createScriptPrisma } from "./db";

async function main() {
  const prisma = createScriptPrisma();

  console.log("=== SUPABASE PRODUCTION DATA ===\n");

  const [
    users, departments, permissions, categories,
    serviceTemplates, taskTemplates, projectTemplates,
    projectTemplateServices, docTypes, docGroups,
    projects, tasks, services,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.department.count(),
    prisma.permission.count(),
    prisma.serviceCategory.count(),
    prisma.serviceTemplate.count(),
    prisma.taskTemplate.count(),
    prisma.projectTemplate.count(),
    prisma.projectTemplateService.count(),
    prisma.docType.count(),
    prisma.documentGroup.count(),
    prisma.project.count(),
    prisma.task.count(),
    prisma.service.count(),
  ]);

  console.log("📊 Counts:");
  console.log(`  Users:                     ${users}`);
  console.log(`  Departments:               ${departments}`);
  console.log(`  Permissions:               ${permissions}`);
  console.log(`  Service Categories:        ${categories}`);
  console.log(`  Service Templates (phases):${serviceTemplates}`);
  console.log(`  Task Templates:            ${taskTemplates}`);
  console.log(`  Project Templates:         ${projectTemplates}`);
  console.log(`  Project-Template links:    ${projectTemplateServices}`);
  console.log(`  Document Types:            ${docTypes}`);
  console.log(`  Document Groups:           ${docGroups}`);
  console.log(`  Projects (actual):         ${projects}`);
  console.log(`  Tasks (actual):            ${tasks}`);
  console.log(`  Services (actual):         ${services}`);

  // Investment template details
  const inv = await prisma.projectTemplate.findFirst({
    where: { name: { contains: "الاستحواذ" } },
    include: {
      services: {
        include: {
          serviceTemplate: {
            include: {
              taskTemplates: { select: { id: true } },
            },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (inv) {
    console.log(`\n📋 Investment Template: "${inv.name}"`);
    console.log(`   Phases: ${inv.services.length}`);
    let total = 0;
    for (const s of inv.services) {
      const n = s.serviceTemplate.taskTemplates.length;
      total += n;
      console.log(`     [${s.sortOrder + 1}] ${s.serviceTemplate.name} — ${n} مهمة`);
    }
    console.log(`   Total tasks: ${total}`);
  } else {
    console.log(`\n⚠️  Investment template NOT FOUND`);
  }

  // Departments list
  const depts = await prisma.department.findMany({ select: { id: true, name: true, nameEn: true } });
  console.log(`\n🏢 Departments (${depts.length}):`);
  for (const d of depts) console.log(`  - ${d.name}${d.nameEn ? ` (${d.nameEn})` : ""}`);

  // Admin user
  const admin = await prisma.user.findFirst({
    where: { email: "m.mosa@bmarsa.com" },
    select: { id: true, name: true, phone: true, role: true, isActive: true },
  });
  console.log(`\n👤 Admin user: ${admin ? JSON.stringify(admin) : "NOT FOUND"}`);

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });

import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Checking for duplicate ServiceTemplates ===");

  // Find duplicates: same name + categoryId
  const serviceTemplates = await prisma.serviceTemplate.findMany({
    orderBy: { createdAt: "asc" },
    include: { category: { select: { name: true } } },
  });

  const stGroups: Record<string, typeof serviceTemplates> = {};
  for (const st of serviceTemplates) {
    const key = `${st.name}__${st.categoryId}`;
    if (!stGroups[key]) stGroups[key] = [];
    stGroups[key].push(st);
  }

  for (const [key, group] of Object.entries(stGroups)) {
    if (group.length <= 1) continue;
    console.log(`\nDuplicate: ${key} (${group.length} copies)`);
    const original = group[0]; // Keep oldest
    const duplicates = group.slice(1);

    for (const dup of duplicates) {
      console.log(`  Removing duplicate: ${dup.id} (created: ${dup.createdAt})`);

      // Move services from duplicate to original
      await prisma.service.updateMany({
        where: { serviceTemplateId: dup.id },
        data: { serviceTemplateId: original.id },
      });

      // Move qualified employees
      const existingEmps = await prisma.serviceTemplateEmployee.findMany({ where: { serviceTemplateId: original.id } });
      const existingEmpIds = existingEmps.map(e => e.userId);
      const dupEmps = await prisma.serviceTemplateEmployee.findMany({ where: { serviceTemplateId: dup.id } });
      for (const emp of dupEmps) {
        if (!existingEmpIds.includes(emp.userId)) {
          await prisma.serviceTemplateEmployee.create({
            data: { serviceTemplateId: original.id, userId: emp.userId },
          });
        }
      }
      await prisma.serviceTemplateEmployee.deleteMany({ where: { serviceTemplateId: dup.id } });

      // Delete task templates of duplicate
      await prisma.taskTemplate.deleteMany({ where: { serviceTemplateId: dup.id } });

      // Delete the duplicate
      await prisma.serviceTemplate.delete({ where: { id: dup.id } });
      console.log(`  ✓ Removed and migrated`);
    }
  }

  console.log("\n=== Checking for duplicate ServiceCategories ===");
  const categories = await prisma.serviceCategory.findMany({ orderBy: { createdAt: "asc" } });
  const catGroups: Record<string, typeof categories> = {};
  for (const cat of categories) {
    if (!catGroups[cat.name]) catGroups[cat.name] = [];
    catGroups[cat.name].push(cat);
  }

  for (const [name, group] of Object.entries(catGroups)) {
    if (group.length <= 1) continue;
    console.log(`\nDuplicate category: ${name} (${group.length} copies)`);
    const original = group[0];
    const duplicates = group.slice(1);

    for (const dup of duplicates) {
      await prisma.serviceTemplate.updateMany({
        where: { categoryId: dup.id },
        data: { categoryId: original.id },
      });
      await prisma.serviceCategory.delete({ where: { id: dup.id } });
      console.log(`  ✓ Removed category ${dup.id}`);
    }
  }

  console.log("\n=== Checking for duplicate ProjectTemplates ===");
  const projectTemplates = await prisma.projectTemplate.findMany({ orderBy: { createdAt: "asc" } });
  const ptGroups: Record<string, typeof projectTemplates> = {};
  for (const pt of projectTemplates) {
    if (!ptGroups[pt.name]) ptGroups[pt.name] = [];
    ptGroups[pt.name].push(pt);
  }

  for (const [name, group] of Object.entries(ptGroups)) {
    if (group.length <= 1) continue;
    console.log(`\nDuplicate project template: ${name} (${group.length} copies)`);
    const original = group[0];
    const duplicates = group.slice(1);

    for (const dup of duplicates) {
      await prisma.project.updateMany({ where: { templateId: dup.id }, data: { templateId: original.id } });
      // Delete template services first
      const ptServices = await prisma.projectTemplateService.findMany({ where: { projectTemplateId: dup.id } });
      for (const pts of ptServices) {
        await prisma.projectTemplateService.delete({ where: { id: pts.id } });
      }
      await prisma.projectTemplate.delete({ where: { id: dup.id } });
      console.log(`  ✓ Removed project template ${dup.id}`);
    }
  }

  console.log("\n=== Checking for duplicate ContractTemplates ===");
  const contractTemplates = await prisma.contractTemplate.findMany({ orderBy: { createdAt: "asc" } });
  const ctGroups: Record<string, typeof contractTemplates> = {};
  for (const ct of contractTemplates) {
    if (!ctGroups[ct.title]) ctGroups[ct.title] = [];
    ctGroups[ct.title].push(ct);
  }

  for (const [title, group] of Object.entries(ctGroups)) {
    if (group.length <= 1) continue;
    console.log(`\nDuplicate contract template: ${title} (${group.length} copies)`);
    const original = group[0];
    const duplicates = group.slice(1);

    for (const dup of duplicates) {
      await prisma.contract.updateMany({ where: { templateId: dup.id }, data: { templateId: original.id } });
      await prisma.contractTemplate.delete({ where: { id: dup.id } });
      console.log(`  ✓ Removed contract template ${dup.id}`);
    }
  }

  console.log("\n=== Cleanup complete ===");
}

main().catch(console.error).finally(() => prisma.$disconnect());

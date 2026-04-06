import { createScriptPrisma } from "./db";

async function main() {
  const prisma = createScriptPrisma();

  console.log("=== PRODUCTION DATA STATUS ===");
  console.log("Users:", await prisma.user.count());
  console.log("Projects:", await prisma.project.count());
  console.log("Tasks:", await prisma.task.count());
  console.log("Services:", await prisma.service.count());
  console.log("Invoices:", await prisma.invoice.count());
  console.log("Contracts:", await prisma.contract.count());
  console.log("Companies:", await prisma.company.count());
  console.log("Departments:", await prisma.department.count());
  console.log("Permissions:", await prisma.permission.count());

  const admin = await prisma.user.findFirst({
    where: { email: "m.mosa@bmarsa.com" },
    select: { id: true, name: true, phone: true, role: true, isActive: true, deletedAt: true },
  });
  console.log("Admin user:", JSON.stringify(admin, null, 2));

  await prisma.$disconnect();
}

main().catch(console.error);

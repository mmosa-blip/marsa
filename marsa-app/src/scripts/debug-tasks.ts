import { prisma } from "../lib/prisma";

async function main() {
  const userServices = await prisma.userService.findMany({
    select: { userId: true, serviceId: true }
  });
  console.log("UserServices:", JSON.stringify(userServices, null, 2));

  const tasks = await prisma.task.findMany({
    where: { assigneeId: null },
    select: { id: true, title: true, serviceId: true },
    take: 10
  });
  console.log("Tasks without assignee:", JSON.stringify(tasks, null, 2));
}

main().finally(() => prisma.$disconnect());

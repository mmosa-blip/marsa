import { prisma } from "../lib/prisma";

async function main() {
  // Get all UserService with service names
  const userServices = await prisma.userService.findMany({
    include: { service: { select: { id: true, name: true } } },
  });

  let total = 0;

  for (const us of userServices) {
    const serviceName = us.service?.name;
    if (!serviceName) continue;

    // Find all project services with same name
    const matchingServices = await prisma.service.findMany({
      where: { name: serviceName },
      select: { id: true },
    });

    const serviceIds = matchingServices.map(s => s.id);
    if (serviceIds.length === 0) continue;

    // Assign tasks
    const result = await prisma.task.updateMany({
      where: { serviceId: { in: serviceIds }, assigneeId: null },
      data: { assigneeId: us.userId, assignedAt: new Date() },
    });

    if (result.count > 0) {
      console.log(`"${serviceName}": ${result.count} tasks → user ${us.userId}`);
      total += result.count;
    }
  }

  console.log(`\nTotal: ${total} tasks assigned`);
  await prisma.$disconnect();
}

main();

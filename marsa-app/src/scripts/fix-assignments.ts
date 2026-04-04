import { prisma } from "../lib/prisma";
async function main() {
  const userServices = await (prisma as any).userService.findMany({ include: { service: { select: { id: true, name: true } } } });
  const executorIds = [...new Set(userServices.map((us: any) => us.userId))];
  for (const executorId of executorIds) {
    const myServices = userServices.filter((us: any) => us.userId === executorId).map((us: any) => us.service?.name).filter(Boolean);
    const validServices = await (prisma as any).service.findMany({ where: { name: { in: myServices } }, select: { id: true } });
    const validServiceIds = validServices.map((s: any) => s.id);
    const removed = await (prisma as any).task.updateMany({ where: { assigneeId: executorId, serviceId: { notIn: validServiceIds } }, data: { assigneeId: null, assignedAt: null } });
    if (removed.count > 0) console.log("Removed " + removed.count + " wrong tasks from " + executorId);
  }
  let total = 0;
  for (const us of userServices) {
    const serviceName = us.service?.name;
    if (!serviceName) continue;
    const matchingServices = await (prisma as any).service.findMany({ where: { name: serviceName }, select: { id: true } });
    const serviceIds = matchingServices.map((s: any) => s.id);
    if (serviceIds.length === 0) continue;
    const result = await (prisma as any).task.updateMany({ where: { serviceId: { in: serviceIds }, assigneeId: null }, data: { assigneeId: us.userId, assignedAt: new Date() } });
    if (result.count > 0) { console.log(serviceName + ": " + result.count + " tasks"); total += result.count; }
  }
  console.log("Total: " + total);
  await prisma.$disconnect();
}
main();

import { PrismaClient } from "./src/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env" });

function createPrisma() {
  const url = new URL(process.env.DATABASE_URL!.replace("mysql://", "http://"));
  const adapter = new PrismaMariaDb({
    host: url.hostname,
    port: parseInt(url.port || "4000"),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
    ssl: true,
  });
  return new PrismaClient({ adapter });
}

async function main() {
  const prisma = createPrisma();

  console.log("=== Backfill Task Assignments ===\n");

  // 1. Tasks with assigneeId → ensure TaskAssignment row exists
  const tasks = await prisma.task.findMany({
    where: { assigneeId: { not: null } },
    select: { id: true, assigneeId: true },
  });
  let n = 0;
  for (const t of tasks) {
    if (!t.assigneeId) continue;
    try {
      await prisma.taskAssignment.upsert({
        where: { taskId_userId: { taskId: t.id, userId: t.assigneeId } },
        create: { taskId: t.id, userId: t.assigneeId },
        update: {},
      });
      n++;
    } catch {
      // skip if constraint error
    }
  }
  console.log(`✅ ${n} direct task assignments backfilled`);

  // 2. UserService → propagate executor to unassigned tasks of that service
  const userServices = await prisma.userService.findMany({
    select: { userId: true, serviceId: true },
  });
  let m = 0;
  for (const us of userServices) {
    const serviceTasks = await prisma.task.findMany({
      where: { serviceId: us.serviceId, status: { not: "CANCELLED" } },
      select: { id: true, assigneeId: true },
    });
    for (const t of serviceTasks) {
      // Assign unassigned tasks
      if (!t.assigneeId) {
        await prisma.task.update({
          where: { id: t.id },
          data: { assigneeId: us.userId, assignedAt: new Date() },
        });
      }
      // Ensure TaskAssignment exists
      try {
        await prisma.taskAssignment.upsert({
          where: { taskId_userId: { taskId: t.id, userId: us.userId } },
          create: { taskId: t.id, userId: us.userId },
          update: {},
        });
        m++;
      } catch {
        // skip
      }
    }
  }
  console.log(`✅ ${m} service-executor task assignments backfilled`);

  // 3. TaskExternalProvider → ensure TaskAssignment exists
  const eps = await prisma.taskExternalProvider.findMany({
    where: { providerStatus: { not: "CANCELLED" } },
    select: { taskId: true, providerId: true },
  });
  let p = 0;
  for (const ep of eps) {
    try {
      await prisma.taskAssignment.upsert({
        where: { taskId_userId: { taskId: ep.taskId, userId: ep.providerId } },
        create: { taskId: ep.taskId, userId: ep.providerId },
        update: {},
      });
      p++;
    } catch {
      // skip
    }
  }
  console.log(`✅ ${p} external provider task assignments backfilled`);

  console.log("\n=== Backfill Complete ===");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

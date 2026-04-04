import "dotenv/config";
import { PrismaClient, Role } from "../src/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import bcrypt from "bcryptjs";

const dbUrl = new URL(process.env.DATABASE_URL!.replace("mysql://", "http://"));
const adapter = new PrismaMariaDb({
  host: dbUrl.hostname,
  port: parseInt(dbUrl.port || "4000"),
  user: decodeURIComponent(dbUrl.username),
  password: decodeURIComponent(dbUrl.password),
  database: dbUrl.pathname.slice(1),
  ssl: true,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("بدء إنشاء بيانات مقدمي الخدمات...");

  // Get an admin/manager as supervisor
  const supervisor = await prisma.user.findFirst({
    where: { role: { in: ["ADMIN", "MANAGER"] } },
  });

  if (!supervisor) {
    console.log("لا يوجد مدير. قم بتشغيل seed أولاً.");
    return;
  }

  const hashedPassword = await bcrypt.hash("Provider@123", 12);

  // === Create Finance Manager ===
  const financeManager = await prisma.user.upsert({
    where: { email: "finance@marsa.sa" },
    update: {},
    create: {
      email: "finance@marsa.sa",
      password: hashedPassword,
      name: "سارة المالكي",
      role: "FINANCE_MANAGER" as Role,
      phone: "0501234567",
    },
  });
  console.log(`✓ مدير مالي: ${financeManager.name}`);

  // === Create Treasury Manager ===
  const treasuryManager = await prisma.user.upsert({
    where: { email: "treasury@marsa.sa" },
    update: {},
    create: {
      email: "treasury@marsa.sa",
      password: hashedPassword,
      name: "فهد الخزنة",
      role: "TREASURY_MANAGER" as Role,
      phone: "0502345678",
    },
  });
  console.log(`✓ أمين صندوق: ${treasuryManager.name}`);

  // === Create 3 External Providers ===
  const provider1 = await prisma.user.upsert({
    where: { email: "provider1@example.com" },
    update: {},
    create: {
      email: "provider1@example.com",
      password: hashedPassword,
      name: "أحمد المعقب",
      role: "EXTERNAL_PROVIDER" as Role,
      phone: "0551234567",
      isExternal: true,
      specialization: "تعقيب حكومي",
      costPerTask: 150,
      bankName: "البنك الأهلي",
      bankIban: "SA1234567890123456789012",
      supervisorId: supervisor.id,
    },
  });
  console.log(`✓ مقدم خدمة: ${provider1.name}`);

  const provider2 = await prisma.user.upsert({
    where: { email: "provider2@example.com" },
    update: {},
    create: {
      email: "provider2@example.com",
      password: hashedPassword,
      name: "محمد المحاسب",
      role: "EXTERNAL_PROVIDER" as Role,
      phone: "0552345678",
      isExternal: true,
      specialization: "محاسبة وزكاة",
      costPerTask: 200,
      bankName: "بنك الراجحي",
      bankIban: "SA9876543210987654321098",
      supervisorId: supervisor.id,
    },
  });
  console.log(`✓ مقدم خدمة: ${provider2.name}`);

  const provider3 = await prisma.user.upsert({
    where: { email: "provider3@example.com" },
    update: {},
    create: {
      email: "provider3@example.com",
      password: hashedPassword,
      name: "خالد المصمم",
      role: "EXTERNAL_PROVIDER" as Role,
      phone: "0553456789",
      isExternal: true,
      specialization: "تصميم وهوية بصرية",
      costPerTask: 300,
      bankName: "بنك الإنماء",
      bankIban: "SA5555666677778888999900",
      supervisorId: supervisor.id,
    },
  });
  console.log(`✓ مقدم خدمة: ${provider3.name}`);

  // === Assign tasks to providers ===
  // Find some existing tasks
  const tasks = await prisma.task.findMany({
    where: { status: { in: ["TODO", "IN_PROGRESS"] } },
    take: 6,
    include: { project: true },
  });

  if (tasks.length === 0) {
    console.log("لا توجد مهام لتعيينها. قم بتشغيل seed-projects أولاً.");
    await prisma.$disconnect();
    return;
  }

  const providers = [provider1, provider2, provider3];

  // Assign tasks to providers (2 each)
  for (let i = 0; i < Math.min(tasks.length, 6); i++) {
    const provider = providers[i % 3];
    await prisma.task.update({
      where: { id: tasks[i].id },
      data: { assigneeId: provider.id },
    });
    console.log(`✓ تعيين "${tasks[i].title}" لـ ${provider.name}`);
  }

  // === Create TaskCosts ===
  const assignedTasks = await prisma.task.findMany({
    where: { assigneeId: { in: providers.map(p => p.id) } },
    include: { assignee: true },
  });

  const taskCosts = [];
  for (const task of assignedTasks) {
    const provider = providers.find(p => p.id === task.assigneeId);
    if (!provider) continue;

    const cost = await prisma.taskCost.upsert({
      where: { taskId_providerId: { taskId: task.id, providerId: provider.id } },
      update: {},
      create: {
        taskId: task.id,
        providerId: provider.id,
        amount: provider.costPerTask || 150,
        notes: `تكلفة تنفيذ: ${task.title}`,
      },
    });
    taskCosts.push(cost);
    console.log(`✓ تكلفة: ${cost.amount} ر.س لمهمة "${task.title}"`);
  }

  // === Create Payment Requests in different states ===
  if (taskCosts.length >= 3) {
    // Request 1: PENDING_SUPERVISOR
    const pr1 = await prisma.paymentRequest.create({
      data: {
        requestNumber: "PR-2026-001",
        amount: taskCosts[0].amount,
        status: "PENDING_SUPERVISOR",
        taskCostId: taskCosts[0].id,
        providerId: providers[0].id,
        requestedById: supervisor.id,
        notes: "طلب صرف لمهمة تعقيب",
      },
    });
    console.log(`✓ طلب صرف: ${pr1.requestNumber} (بانتظار المشرف)`);

    // Request 2: PENDING_FINANCE (supervisor approved)
    const pr2 = await prisma.paymentRequest.create({
      data: {
        requestNumber: "PR-2026-002",
        amount: taskCosts[1].amount,
        status: "PENDING_FINANCE",
        taskCostId: taskCosts[1].id,
        providerId: providers[1].id,
        requestedById: supervisor.id,
        notes: "طلب صرف لمهمة محاسبة",
        supervisorApproval: true,
        supervisorApprovedAt: new Date(),
        supervisorNotes: "تمت الموافقة، عمل ممتاز",
      },
    });
    console.log(`✓ طلب صرف: ${pr2.requestNumber} (بانتظار المالية)`);

    // Request 3: PAID (fully approved)
    const pr3 = await prisma.paymentRequest.create({
      data: {
        requestNumber: "PR-2026-003",
        amount: taskCosts[2].amount,
        status: "PAID",
        taskCostId: taskCosts[2].id,
        providerId: providers[2].id,
        requestedById: supervisor.id,
        notes: "طلب صرف لمهمة تصميم",
        supervisorApproval: true,
        supervisorApprovedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        supervisorNotes: "موافق",
        financeApproval: true,
        financeApprovedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        financeNotes: "تمت المراجعة والموافقة",
        treasuryApproval: true,
        treasuryApprovedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        treasuryNotes: "تم الصرف",
        paymentMethod: "BANK_TRANSFER",
        paymentReference: "TRF-98765",
        paidAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      },
    });
    console.log(`✓ طلب صرف: ${pr3.requestNumber} (مدفوع)`);
  }

  console.log("\n✅ تم إنشاء بيانات مقدمي الخدمات بنجاح!");
  console.log("بيانات الدخول:");
  console.log("  مدير مالي: finance@marsa.sa / Provider@123");
  console.log("  أمين صندوق: treasury@marsa.sa / Provider@123");
  console.log("  مقدم خدمة 1: provider1@example.com / Provider@123");
  console.log("  مقدم خدمة 2: provider2@example.com / Provider@123");
  console.log("  مقدم خدمة 3: provider3@example.com / Provider@123");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});

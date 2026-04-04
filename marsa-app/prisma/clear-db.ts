import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

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

async function clearDatabase() {
  console.log("🗑️  حذف جميع البيانات من قاعدة البيانات...");

  // Delete in order respecting foreign key constraints
  // (children first, parents last)

  await prisma.projectClosureDelegation.deleteMany();
  console.log("  ✓ ProjectClosureDelegation");

  await prisma.projectMilestone.deleteMany();
  console.log("  ✓ ProjectMilestone");

  await prisma.projectRequirement.deleteMany();
  console.log("  ✓ ProjectRequirement");

  await prisma.setting.deleteMany();
  console.log("  ✓ Setting");

  await prisma.taskTransferDelegation.deleteMany();
  console.log("  ✓ TaskTransferDelegation");

  await prisma.taskTransferRequest.deleteMany();
  console.log("  ✓ TaskTransferRequest");

  await prisma.taskRejection.deleteMany();
  console.log("  ✓ TaskRejection");

  await prisma.serviceProviderMapping.deleteMany();
  console.log("  ✓ ServiceProviderMapping");

  await prisma.message.deleteMany();
  console.log("  ✓ Message");

  await prisma.conversation.deleteMany();
  console.log("  ✓ Conversation");

  await prisma.notification.deleteMany();
  console.log("  ✓ Notification");

  await prisma.paymentRequest.deleteMany();
  console.log("  ✓ PaymentRequest");

  await prisma.taskCost.deleteMany();
  console.log("  ✓ TaskCost");

  await prisma.projectTemplateService.deleteMany();
  console.log("  ✓ ProjectTemplateService");

  await prisma.projectTemplate.deleteMany();
  console.log("  ✓ ProjectTemplate");

  await prisma.serviceTemplateEmployee.deleteMany();
  console.log("  ✓ ServiceTemplateEmployee");

  await prisma.taskTemplate.deleteMany();
  console.log("  ✓ TaskTemplate");

  await prisma.serviceTemplate.deleteMany();
  console.log("  ✓ ServiceTemplate");

  await prisma.serviceCategory.deleteMany();
  console.log("  ✓ ServiceCategory");

  await prisma.cashierTransaction.deleteMany();
  console.log("  ✓ CashierTransaction");

  await prisma.document.deleteMany();
  console.log("  ✓ Document");

  await prisma.payment.deleteMany();
  console.log("  ✓ Payment");

  await prisma.invoiceItem.deleteMany();
  console.log("  ✓ InvoiceItem");

  await prisma.invoice.deleteMany();
  console.log("  ✓ Invoice");

  await prisma.reminder.deleteMany();
  console.log("  ✓ Reminder");

  await prisma.attendance.deleteMany();
  console.log("  ✓ Attendance");

  await prisma.leaveRequest.deleteMany();
  console.log("  ✓ LeaveRequest");

  await prisma.employee.deleteMany();
  console.log("  ✓ Employee");

  await prisma.task.deleteMany();
  console.log("  ✓ Task");

  await prisma.service.deleteMany();
  console.log("  ✓ Service");

  await prisma.project.deleteMany();
  console.log("  ✓ Project");

  await prisma.company.deleteMany();
  console.log("  ✓ Company");

  await prisma.user.deleteMany();
  console.log("  ✓ User");

  console.log("\n✅ تم حذف جميع البيانات بنجاح!");
}

clearDatabase()
  .catch((e) => {
    console.error("❌ خطأ في حذف البيانات:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

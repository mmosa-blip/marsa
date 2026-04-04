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

async function main() {
  // Get admin user
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!admin) { console.log("لا يوجد مدير. قم بتشغيل seed أولاً."); return; }

  // Get service templates
  const serviceTemplates = await prisma.serviceTemplate.findMany({
    include: { category: true },
  });

  const findTemplate = (name: string) => serviceTemplates.find(t => t.name.includes(name));

  const sjtl = findTemplate("سجل تجاري");
  const rkhsa = findTemplate("رخصة بلدية");
  const zakat = findTemplate("شهادة زكاة");
  const iqrar = findTemplate("إقرار ضريبي");
  const kafala = findTemplate("نقل كفالة");
  const iqama = findTemplate("تجديد إقامة");

  if (!sjtl || !rkhsa || !zakat || !iqrar || !kafala || !iqama) {
    console.log("بعض قوالب الخدمات مفقودة. قم بتشغيل seed-service-catalog أولاً.");
    console.log("الموجود:", serviceTemplates.map(t => t.name));
    return;
  }

  // ===== قالب 1: تأسيس شركة جديدة (تسلسلي) =====
  const tpl1 = await prisma.projectTemplate.create({
    data: {
      name: "تأسيس شركة جديدة",
      description: "حزمة شاملة لتأسيس شركة جديدة تشمل السجل التجاري والرخصة البلدية وشهادة الزكاة",
      workflowType: "SEQUENTIAL",
      isSystem: true,
      createdById: admin.id,
      services: {
        create: [
          { serviceTemplateId: sjtl.id, sortOrder: 0 },
          { serviceTemplateId: rkhsa.id, sortOrder: 1 },
          { serviceTemplateId: zakat.id, sortOrder: 2 },
        ],
      },
    },
  });

  // ===== قالب 2: تجديدات سنوية (مستقل) =====
  const tpl2 = await prisma.projectTemplate.create({
    data: {
      name: "تجديدات سنوية",
      description: "حزمة التجديدات السنوية للشركات — يمكن تنفيذها بالتوازي",
      workflowType: "INDEPENDENT",
      isSystem: true,
      createdById: admin.id,
      services: {
        create: [
          { serviceTemplateId: sjtl.id, sortOrder: 0 },
          { serviceTemplateId: rkhsa.id, sortOrder: 1 },
          { serviceTemplateId: iqrar.id, sortOrder: 2 },
        ],
      },
    },
  });

  // ===== قالب 3: حزمة موارد بشرية (تسلسلي) =====
  const tpl3 = await prisma.projectTemplate.create({
    data: {
      name: "حزمة موارد بشرية",
      description: "نقل كفالة وتجديد إقامة — يجب تنفيذ نقل الكفالة أولاً",
      workflowType: "SEQUENTIAL",
      isSystem: true,
      createdById: admin.id,
      services: {
        create: [
          { serviceTemplateId: kafala.id, sortOrder: 0 },
          { serviceTemplateId: iqama.id, sortOrder: 1 },
        ],
      },
    },
  });

  // ===== مشروع تجريبي مرتبط بعميل =====
  const client = await prisma.user.findFirst({ where: { role: "CLIENT" } });
  if (client) {
    // Use generate-tasks-like logic to create a real project
    const now = new Date();
    const templateServices = [sjtl, rkhsa];
    let totalDuration = 0;
    let totalPrice = 0;

    for (const tmpl of templateServices) {
      const tasks = await prisma.taskTemplate.findMany({ where: { serviceTemplateId: tmpl.id }, orderBy: { sortOrder: "asc" } });
      const dur = tmpl.defaultDuration || tasks.reduce((s, t) => s + t.defaultDuration, 0);
      totalDuration += dur;
      totalPrice += tmpl.defaultPrice || 0;
    }

    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + totalDuration);

    const project = await prisma.project.create({
      data: {
        name: "تأسيس شركة الرؤية",
        description: "مشروع تأسيس شركة جديدة للعميل",
        clientId: client.id,
        managerId: admin.id,
        workflowType: "SEQUENTIAL",
        totalPrice,
        status: "ACTIVE",
        startDate: now,
        endDate,
        templateId: tpl1.id,
      },
    });

    let serviceStartDate = new Date(now);

    for (let si = 0; si < templateServices.length; si++) {
      const tmpl = templateServices[si];
      const taskTemplates = await prisma.taskTemplate.findMany({
        where: { serviceTemplateId: tmpl.id },
        orderBy: { sortOrder: "asc" },
      });
      const employees = await prisma.serviceTemplateEmployee.findMany({
        where: { serviceTemplateId: tmpl.id },
      });

      const svcDuration = tmpl.defaultDuration || taskTemplates.reduce((s, t) => s + t.defaultDuration, 0);

      const service = await prisma.service.create({
        data: {
          name: tmpl.name,
          category: tmpl.category?.name || null,
          price: tmpl.defaultPrice,
          duration: svcDuration,
          clientId: client.id,
          projectId: project.id,
          status: si === 0 ? "IN_PROGRESS" : "PENDING",
        },
      });

      let taskStartDate = new Date(serviceStartDate);

      for (let ti = 0; ti < taskTemplates.length; ti++) {
        const tt = taskTemplates[ti];
        const dueDate = new Date(taskStartDate);
        dueDate.setDate(dueDate.getDate() + tt.defaultDuration);

        await prisma.task.create({
          data: {
            title: tt.name,
            status: si === 0 && ti === 0 ? "IN_PROGRESS" : "TODO",
            priority: "MEDIUM",
            order: tt.sortOrder,
            dueDate,
            serviceId: service.id,
            projectId: project.id,
            assigneeId: employees.length > 0 ? employees[ti % employees.length].userId : null,
          },
        });

        taskStartDate = new Date(dueDate);
      }

      serviceStartDate = new Date(serviceStartDate);
      serviceStartDate.setDate(serviceStartDate.getDate() + svcDuration);
    }

    console.log(`✅ مشروع تجريبي "تأسيس شركة الرؤية" تم إنشاؤه للعميل: ${client.name}`);
  }

  console.log("✅ تم إنشاء قوالب المشاريع بنجاح!");
  console.log(`   - 3 قوالب نظام`);
  console.log(`   - ${await prisma.projectTemplateService.count()} ربط خدمة بقالب`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

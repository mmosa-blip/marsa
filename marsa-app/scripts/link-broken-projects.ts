import 'dotenv/config';

async function run() {
  const { prisma } = await import('../src/lib/prisma');

  const brokenProjects = await prisma.project.findMany({
    where: {
      services: {
        some: {
          OR: [
            { serviceTemplateId: null },
            { duration: null },
          ],
        },
      },
      templateId: { not: null },
    },
    include: {
      services: true,
      template: {
        include: {
          services: {
            include: { serviceTemplate: true },
          },
        },
      },
    },
  });

  console.log(`المشاريع المستهدفة: ${brokenProjects.length}`);

  let linkedCount = 0;
  let skippedCount = 0;

  for (const project of brokenProjects) {
    console.log(`\n=== ${project.name} ===`);

    if (!project.template) continue;

    const templateMap = new Map(
      project.template.services.map((ts) => [ts.serviceTemplate.name, ts])
    );

    for (const service of project.services) {
      const templateService = templateMap.get(service.name);

      if (!templateService) {
        console.log(`  ⚠️ لا يوجد قالب لـ: ${service.name}`);
        skippedCount++;
        continue;
      }

      const st = templateService.serviceTemplate;

      // احسب duration من taskTemplates إذا defaultDuration=null
      let duration: number | null = st.defaultDuration ?? null;
      if (!duration) {
        const taskTemplates = await prisma.taskTemplate.findMany({
          where: { serviceTemplateId: st.id },
          select: { defaultDuration: true },
        });
        const sum = taskTemplates.reduce((s, t) => s + (t.defaultDuration || 0), 0);
        duration = sum > 0 ? sum : null;
      }

      await prisma.service.update({
        where: { id: service.id },
        data: {
          serviceTemplateId: st.id,
          duration: duration,
          // لا نغير executionMode أو isBackground - قد تكون محددة يدوياً
        },
      });

      console.log(`  ✅ ${service.name} | duration: ${duration}`);
      linkedCount++;
    }
  }

  console.log(`\n\nالخلاصة:`);
  console.log(`  ربط ناجح: ${linkedCount}`);
  console.log(`  تخطي: ${skippedCount}`);

  await prisma.$disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

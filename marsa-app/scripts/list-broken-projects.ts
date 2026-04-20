import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

(async () => {
  // المرحلة 1: قائمة مختصرة
  const broken = await prisma.project.findMany({
    where: {
      services: {
        some: {
          OR: [
            { serviceTemplateId: null },
            { duration: null },
          ],
        },
      },
    },
    select: {
      id: true,
      projectCode: true,
      name: true,
      workflowType: true,
      _count: { select: { services: true } },
    },
  });

  console.log('=== المرحلة 1: المشاريع المكسورة ===');
  console.log('الإجمالي:', broken.length);
  broken.forEach((p) => {
    console.log(`- ${p.projectCode || '(بدون كود)'} | ${p.name} | خدمات: ${p._count.services}`);
  });

  // المرحلة 2: تفاصيل كل مشروع + قالبه
  const projects = await prisma.project.findMany({
    where: {
      services: {
        some: {
          OR: [
            { serviceTemplateId: null },
            { duration: null },
          ],
        },
      },
    },
    include: {
      services: {
        select: {
          id: true,
          name: true,
          duration: true,
          executionMode: true,
          isBackground: true,
          serviceTemplateId: true,
          serviceOrder: true,
        },
        orderBy: { serviceOrder: 'asc' },
      },
      template: {
        include: {
          services: {
            include: { serviceTemplate: true },
            orderBy: { sortOrder: 'asc' },
          },
        },
      },
    },
  });

  for (const p of projects) {
    console.log(`\n\n=== ${p.name} (${p.projectCode || 'بدون كود'}) ===`);
    console.log('Template:', p.template?.name || 'لا يوجد');

    console.log('\nالخدمات الحالية:');
    p.services.forEach((s) => {
      console.log(`  [${s.serviceOrder}] ${s.name}`);
      console.log(`      duration: ${s.duration}, mode: ${s.executionMode}, bg: ${s.isBackground}`);
      console.log(`      templateId: ${s.serviceTemplateId || 'MISSING'}`);
    });

    if (p.template) {
      console.log('\nقالب المشروع يحتوي:');
      p.template.services.forEach((ts: any) => {
        console.log(`  - ${ts.serviceTemplate.name} (id: ${ts.serviceTemplate.id})`);
        console.log(`      duration: ${ts.serviceTemplate.defaultDuration}, mode: ${ts.executionMode}, bg: ${ts.isBackground}`);
      });

      // تحليل تطابق الأسماء
      const svcNames = new Set(p.services.map((s) => s.name.trim()));
      const tmplNames = new Set(p.template.services.map((ts: any) => (ts.serviceTemplate.name as string).trim()));
      const svcMatched = p.services.filter((s) => tmplNames.has(s.name.trim()));
      const tmplMatched = p.template.services.filter((ts: any) => svcNames.has((ts.serviceTemplate.name as string).trim()));
      console.log('\nتحليل تطابق الأسماء:');
      console.log(`  خدمات المشروع: ${p.services.length} | قالب: ${p.template.services.length}`);
      console.log(`  خدمات مطابقة بالاسم من المشروع للقالب: ${svcMatched.length}/${p.services.length}`);
      console.log(`  خدمات مطابقة بالاسم من القالب للمشروع: ${tmplMatched.length}/${p.template.services.length}`);

      const unmatchedSvc = p.services.filter((s) => !tmplNames.has(s.name.trim()));
      if (unmatchedSvc.length > 0) {
        console.log('  خدمات بلا مطابق في القالب:');
        unmatchedSvc.forEach((s) => console.log(`    • "${s.name}"`));
      }
      const unmatchedTmpl = p.template.services.filter((ts: any) => !svcNames.has((ts.serviceTemplate.name as string).trim()));
      if (unmatchedTmpl.length > 0) {
        console.log('  خدمات في القالب لا توجد في المشروع:');
        unmatchedTmpl.forEach((ts: any) => console.log(`    • "${ts.serviceTemplate.name}"`));
      }
    }
  }

  await prisma.$disconnect();
})();

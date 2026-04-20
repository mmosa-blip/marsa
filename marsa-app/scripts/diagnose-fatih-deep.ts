import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

(async () => {
  const project = await prisma.project.findFirst({
    where: { name: { contains: 'FATIH' } },
    select: { id: true, templateId: true, startDate: true, endDate: true }
  });
  if (!project) { console.log('NOT FOUND'); await prisma.$disconnect(); return; }

  // Fetch services with raw serviceTemplateId then check template separately
  const services = await prisma.service.findMany({
    where: { projectId: project.id },
    select: {
      id: true,
      name: true,
      duration: true,
      executionMode: true,
      serviceOrder: true,
      isBackground: true,
      serviceTemplateId: true
    },
    orderBy: { serviceOrder: 'asc' }
  });

  console.log('Project.templateId:', project.templateId);
  console.log('Project services count:', services.length);
  console.log('Services with serviceTemplateId set:', services.filter(s=>s.serviceTemplateId).length);
  console.log('Services with null serviceTemplateId:', services.filter(s=>!s.serviceTemplateId).length);

  // Fetch the templates referenced
  const tmplIds = Array.from(new Set(services.map(s => s.serviceTemplateId).filter(Boolean))) as string[];
  const templates = tmplIds.length ? await prisma.serviceTemplate.findMany({
    where: { id: { in: tmplIds } },
    select: {
      id: true, name: true, defaultDuration: true, workflowType: true,
      taskTemplates: { select: { id: true, name: true, defaultDuration: true } }
    }
  }) : [];
  const tmap = new Map(templates.map(t => [t.id, t]));

  console.log('\n=== Service instances vs templates ===');
  let totalSeq = 0, maxPar = 0, totalTasksSum = 0;
  for (const s of services) {
    const tmpl = s.serviceTemplateId ? tmap.get(s.serviceTemplateId) : null;
    const tmplSum = tmpl?.taskTemplates.reduce((a, t) => a + (t.defaultDuration || 0), 0) ?? 0;
    const svcDuration = tmpl ? (tmpl.defaultDuration || tmplSum) : 0;
    console.log(`[${s.serviceOrder}] "${s.name}"`);
    console.log(`    svc.duration=${s.duration}, mode=${s.executionMode}, bg=${s.isBackground}`);
    console.log(`    tmpl? ${tmpl ? 'YES ('+tmpl.id+')' : 'NO'}  tmpl.defaultDuration=${tmpl?.defaultDuration}, taskTmpls.count=${tmpl?.taskTemplates.length}, tmplSum=${tmplSum}`);
    console.log(`    → svcDuration (as computed by /api/projects/route.ts) = ${svcDuration}`);

    if (!s.isBackground) {
      totalSeq += svcDuration;
      maxPar = Math.max(maxPar, svcDuration);
      totalTasksSum += tmplSum;
    }
  }

  console.log('\n=== المجاميع المتوقعة من القوالب ===');
  console.log('  SUM(svcDuration)[SEQUENTIAL بحسب workflowType المشروع] =', totalSeq, 'يوم');
  console.log('  MAX(svcDuration)[PARALLEL] =', maxPar, 'يوم');

  // Check tasks' dueDates — they may extend beyond service durations
  console.log('\n=== Task dueDates ===');
  const tasks = await prisma.task.findMany({
    where: { projectId: project.id },
    select: { id: true, dueDate: true, status: true, service: { select: { name: true, serviceOrder: true } } },
    orderBy: { dueDate: 'asc' }
  });
  const withDue = tasks.filter(t => t.dueDate);
  console.log('  tasks with dueDate:', withDue.length, '/', tasks.length);
  if (withDue.length > 0) {
    console.log('  earliest dueDate:', withDue[0].dueDate?.toISOString());
    console.log('  latest   dueDate:', withDue[withDue.length - 1].dueDate?.toISOString());
  }

  console.log('\n=== ProjectTemplate referenced by project ===');
  if (project.templateId) {
    const pt = await prisma.projectTemplate.findUnique({
      where: { id: project.templateId },
      select: {
        id: true, name: true, workflowType: true, isActive: true,
        services: {
          select: {
            sortOrder: true,
            executionMode: true,
            serviceTemplate: {
              select: { id: true, name: true, defaultDuration: true, taskTemplates: { select: { defaultDuration: true } } }
            }
          },
          orderBy: { sortOrder: 'asc' }
        }
      }
    });
    console.log('  name:', pt?.name, '| workflowType:', pt?.workflowType);
    let ptSum = 0, ptMax = 0;
    pt?.services.forEach((s: any) => {
      const d = s.serviceTemplate?.defaultDuration ?? (s.serviceTemplate?.taskTemplates.reduce((a: number, t: any)=>a+(t.defaultDuration||0),0) ?? 0);
      console.log(`    [${s.sortOrder}] ${s.serviceTemplate?.name} | defaultDuration=${d} | execMode=${s.executionMode}`);
      ptSum += d;
      ptMax = Math.max(ptMax, d);
    });
    console.log('  ProjectTemplate SUM =', ptSum, ' | MAX =', ptMax);
  }

  await prisma.$disconnect();
})();

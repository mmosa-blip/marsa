import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

(async () => {
  const project = await prisma.project.findFirst({
    where: { name: { contains: 'FATIH' } },
    select: {
      id: true,
      name: true,
      workflowType: true,
      startDate: true,
      endDate: true,
      templateId: true,
      template: {
        select: { id: true, name: true, workflowType: true }
      },
      services: {
        select: {
          id: true,
          name: true,
          duration: true,
          executionMode: true,
          serviceOrder: true,
          isBackground: true,
          serviceTemplateId: true,
          serviceTemplate: {
            select: {
              id: true,
              name: true,
              defaultDuration: true,
              workflowType: true,
              taskTemplates: {
                select: { id: true, defaultDuration: true, name: true }
              }
            }
          },
          tasks: {
            select: { id: true, status: true, dueDate: true }
          }
        },
        orderBy: { serviceOrder: 'asc' }
      }
    } as never
  }) as any;

  if (!project) { console.log('NOT FOUND'); await prisma.$disconnect(); return; }

  console.log('=== Project ===');
  console.log('  id:', project.id);
  console.log('  name:', project.name);
  console.log('  workflowType:', project.workflowType);
  console.log('  startDate:', project.startDate?.toISOString());
  console.log('  endDate:', project.endDate?.toISOString());
  const diffCal = Math.ceil((new Date(project.endDate).getTime() - new Date(project.startDate).getTime()) / (1000*60*60*24));
  console.log('  (endDate - startDate) calendar days:', diffCal);
  // working days simulation
  let wd = 0;
  const d = new Date(project.startDate);
  const end = new Date(project.endDate);
  while (d < end) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 6) wd++;
  }
  console.log('  (endDate - startDate) working days:', wd);
  console.log('  template:', project.template);

  console.log('\n=== Services (instance + template) ===');
  let sumSequentialTmpl = 0, maxParallelTmpl = 0;
  let sumSequentialInst = 0, maxParallelInst = 0;
  let sumAllTaskTmplDurations = 0;
  const bgServices: string[] = [];
  const fgServices: Array<{ name: string; tmplDur: number; instDur: number | null; order: number; mode: string }> = [];

  for (const s of project.services) {
    const tmplDur: number = s.serviceTemplate?.defaultDuration
      || (s.serviceTemplate?.taskTemplates?.reduce((sum: number, t: any) => sum + (t.defaultDuration || 0), 0) ?? 0);
    const instDur: number | null = s.duration;
    const taskTmplSum = s.serviceTemplate?.taskTemplates?.reduce((sum: number, t: any) => sum + (t.defaultDuration || 0), 0) ?? 0;
    sumAllTaskTmplDurations += taskTmplSum;

    console.log(`  [${s.serviceOrder}] "${s.name}"`);
    console.log(`      mode=${s.executionMode}, bg=${s.isBackground}, instance.duration=${instDur}, template.defaultDuration=${s.serviceTemplate?.defaultDuration}, sum(task.defaultDuration)=${taskTmplSum}`);
    console.log(`      tasks=${s.tasks.length}`);

    if (!s.isBackground) {
      fgServices.push({ name: s.name, tmplDur, instDur: instDur ?? null, order: s.serviceOrder, mode: s.executionMode });
      sumSequentialTmpl += tmplDur;
      maxParallelTmpl = Math.max(maxParallelTmpl, tmplDur);
      sumSequentialInst += (instDur ?? 0);
      maxParallelInst = Math.max(maxParallelInst, instDur ?? 0);
    } else {
      bgServices.push(s.name);
    }
  }

  console.log('\n=== حساب المدة المتوقعة (باستخدام project.workflowType) ===');
  console.log('  project.workflowType =', project.workflowType);
  if (project.workflowType === 'SEQUENTIAL') {
    console.log('  SUM(template.defaultDuration) =', sumSequentialTmpl, 'يوم عمل');
    console.log('  SUM(instance.duration)        =', sumSequentialInst, 'يوم عمل');
  } else if (project.workflowType === 'PARALLEL') {
    console.log('  MAX(template.defaultDuration) =', maxParallelTmpl, 'يوم عمل');
    console.log('  MAX(instance.duration)        =', maxParallelInst, 'يوم عمل');
  }
  console.log('  SUM(كل مهام القالب) =', sumAllTaskTmplDurations, 'يوم عمل');
  console.log('  background services ignored:', bgServices);

  console.log('\n=== الفعلي في DB ===');
  console.log('  project.endDate - startDate =', wd, 'يوم عمل');

  await prisma.$disconnect();
})();

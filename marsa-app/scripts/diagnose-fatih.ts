import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

(async () => {
  const project = await prisma.project.findFirst({
    where: { name: { contains: 'FATIH' } },
    select: { id: true, name: true }
  });
  console.log('المشروع:', project);
  if (!project) { await prisma.$disconnect(); return; }

  const tasksViaService = await prisma.task.findMany({
    where: { service: { projectId: project.id } },
    select: { id: true, status: true, dueDate: true, projectId: true, serviceId: true, service: { select: { deletedAt: true, name: true } } }
  });
  console.log('\n=== عبر service.projectId (مسار Operations via services) ===');
  console.log('إجمالي:', tasksViaService.length);
  const bySvc: Record<string, number> = {};
  tasksViaService.forEach(t => { bySvc[t.status] = (bySvc[t.status]||0)+1; });
  console.log('حسب الحالة:', bySvc);
  console.log('svc.deletedAt != null:', tasksViaService.filter(t=>t.service?.deletedAt).length);
  console.log('task.projectId null (via service only):', tasksViaService.filter(t=>!t.projectId).length);

  const tasksViaProjectId = await prisma.task.findMany({
    where: { projectId: project.id },
    select: { id: true, status: true, serviceId: true, dueDate: true }
  });
  console.log('\n=== عبر task.projectId (مسار Health) ===');
  console.log('إجمالي:', tasksViaProjectId.length);
  const byPid: Record<string, number> = {};
  tasksViaProjectId.forEach(t => { byPid[t.status] = (byPid[t.status]||0)+1; });
  console.log('حسب الحالة:', byPid);
  console.log('serviceId null:', tasksViaProjectId.filter(t=>!t.serviceId).length);

  console.log('\n=== فلتر Health ACTUAL (projectId + status!=CANCELLED) ===');
  const healthF = tasksViaProjectId.filter(t => t.status !== 'CANCELLED');
  console.log('total:', healthF.length);
  console.log('DONE:', healthF.filter(t=>t.status==='DONE').length);
  console.log('IN_PROGRESS:', healthF.filter(t=>t.status==='IN_PROGRESS').length);
  const now = new Date();
  console.log('overdue:', healthF.filter(t=>t.dueDate && new Date(t.dueDate)<now && t.status!=='DONE' && t.status!=='CANCELLED').length);

  console.log('\n=== فلتر Operations ACTUAL (services.deletedAt=null → tasks, no status filter) ===');
  const svcs = await prisma.service.findMany({
    where: { projectId: project.id, deletedAt: null },
    select: { id: true, name: true, deletedAt: true, tasks: { select: { id: true, status: true, dueDate: true } } }
  });
  const opsTasks = svcs.flatMap(s=>s.tasks);
  console.log('total (operations progress denominator):', opsTasks.length);
  const byOps: Record<string, number> = {};
  opsTasks.forEach(t=>{ byOps[t.status]=(byOps[t.status]||0)+1; });
  console.log('حسب الحالة:', byOps);
  const ACTIVE = ['TODO','WAITING','IN_PROGRESS','IN_REVIEW','WAITING_EXTERNAL'];
  console.log('DONE:', opsTasks.filter(t=>t.status==='DONE').length);
  console.log('active:', opsTasks.filter(t=>ACTIVE.includes(t.status)).length);
  console.log('late:', opsTasks.filter(t=>t.dueDate && new Date(t.dueDate)<now && t.status!=='DONE' && t.status!=='CANCELLED').length);
  console.log('progress%:', opsTasks.length>0 ? Math.round(opsTasks.filter(t=>t.status==='DONE').length/opsTasks.length*100) : 0);

  console.log('\n=== كل services للمشروع (مع deletedAt) ===');
  const allSvcs = await prisma.service.findMany({
    where: { projectId: project.id },
    select: { id: true, name: true, deletedAt: true, _count: { select: { tasks: true } } }
  });
  allSvcs.forEach(s => console.log(` - ${s.name}: deletedAt=${s.deletedAt}, tasks=${s._count.tasks}`));

  await prisma.$disconnect();
})();

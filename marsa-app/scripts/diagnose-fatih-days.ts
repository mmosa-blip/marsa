import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import { countWorkingDays } from '../src/lib/working-days';

(async () => {
  const project = await prisma.project.findFirst({
    where: { name: { contains: 'FATIH' } },
    select: {
      id: true,
      name: true,
      startDate: true,
      endDate: true,
      createdAt: true,
      contractStartDate: true,
      contractEndDate: true,
      contractDurationDays: true,
      contractId: true,
      contract: {
        select: {
          id: true,
          startDate: true,
          endDate: true,
          status: true,
          contractNumber: true,
        }
      },
    }
  });

  console.log('=== بيانات المشروع ===');
  console.log(JSON.stringify(project, null, 2));

  if (!project) { await prisma.$disconnect(); return; }

  const now = new Date();
  console.log('\n=== "الآن" ===');
  console.log(now.toISOString(), '(local:', now.toString() + ')');

  console.log('\n=== الفارق بالأيام التقويمية (calendar) ===');
  const calc = (d: Date | null | undefined, label: string) => {
    if (!d) { console.log(`${label}: null`); return; }
    const diff = Math.ceil((new Date(d).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    console.log(`${label}: ${diff} يوم (حتى ${new Date(d).toISOString().slice(0,10)})`);
  };
  calc(project.endDate, 'project.endDate');
  calc(project.contractEndDate, 'project.contractEndDate');
  calc(project.contract?.endDate, 'contract.endDate');

  console.log('\n=== الفارق بأيام العمل (countWorkingDays — السلوك الفعلي في الـ APIs) ===');
  const wd = (d: Date | null | undefined, label: string) => {
    if (!d) { console.log(`${label}: null`); return; }
    const dd = new Date(d);
    const val = dd > now ? countWorkingDays(now, dd) : 0;
    console.log(`${label}: ${val} يوم عمل`);
  };
  wd(project.endDate, 'project.endDate');
  wd(project.contractEndDate, 'project.contractEndDate');
  wd(project.contract?.endDate, 'contract.endDate');

  console.log('\n=== محاكاة منطق Health API ===');
  console.log('  fallback: contractEndDate || endDate');
  const healthEnd = project.contractEndDate || project.endDate;
  console.log('  → يختار:', healthEnd ? new Date(healthEnd).toISOString() : 'null');
  if (healthEnd) {
    const dl = new Date(healthEnd);
    const daysRemaining = dl > now ? countWorkingDays(now, dl) : 0;
    console.log('  → daysRemaining (Health):', daysRemaining);
  }

  console.log('\n=== محاكاة منطق Operations API ===');
  console.log('  fallback: contractEndDate || contract.endDate');
  const opsEnd = project.contractEndDate || project.contract?.endDate || null;
  console.log('  → يختار:', opsEnd ? new Date(opsEnd).toISOString() : 'null');
  if (opsEnd) {
    const ce = new Date(opsEnd);
    const daysRemaining = ce <= now ? 0 : countWorkingDays(now, ce);
    console.log('  → daysRemaining (Operations):', daysRemaining);
  }

  await prisma.$disconnect();
})();

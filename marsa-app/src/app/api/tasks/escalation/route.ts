import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const ESCALATION_COOLDOWN_HOURS = 24;

export async function POST(request: NextRequest) {
  try {
    // Simple auth: cron secret or admin session
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      // Fall back to session check
      const { getServerSession } = await import("next-auth");
      const { authOptions } = await import("@/lib/auth");
      const session = await getServerSession(authOptions);
      if (!session || !["ADMIN", "MANAGER"].includes(session.user.role)) {
        return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
      }
    }

    const now = new Date();
    const cooldownThreshold = new Date(now.getTime() - ESCALATION_COOLDOWN_HOURS * 60 * 60 * 1000);

    // Find overdue tasks that are not DONE/CANCELLED
    const overdueTasks = await prisma.task.findMany({
      where: {
        dueDate: { lt: now },
        status: { notIn: ["DONE", "CANCELLED"] },
        serviceId: { not: null },
        // Only tasks not recently escalated
        OR: [
          { lastEscalatedAt: null },
          { lastEscalatedAt: { lt: cooldownThreshold } },
        ],
      },
      include: {
        service: {
          select: {
            id: true,
            name: true,
            serviceTemplateId: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
            client: { select: { id: true, name: true } },
          },
        },
        assignee: { select: { id: true, name: true } },
      },
    });

    if (overdueTasks.length === 0) {
      return NextResponse.json({ escalated: 0, message: "لا توجد مهام متأخرة تحتاج تصعيد" });
    }

    // Get all admins/managers for notifications
    const managers = await prisma.user.findMany({
      where: { role: { in: ["ADMIN", "MANAGER"] }, isActive: true, deletedAt: null },
      select: { id: true },
    });
    const managerIds = managers.map((m) => m.id);

    let escalatedCount = 0;

    for (const task of overdueTasks) {
      if (!task.service?.serviceTemplateId) continue;

      // Get escalation chain for this service template
      const escalationChain = await prisma.serviceTemplateEscalation.findMany({
        where: { serviceTemplateId: task.service.serviceTemplateId },
        orderBy: { priority: "asc" },
        include: { user: { select: { id: true, name: true } } },
      });

      if (escalationChain.length === 0) continue;

      const currentLevel = task.escalationLevel;
      const nextLevel = currentLevel + 1;

      // Check if there's a next escalation employee
      const nextEscalation = escalationChain.find((e) => e.priority === nextLevel);
      const previousAssigneeName = task.assignee?.name || "غير محدد";
      const daysOverdue = Math.max(1, Math.floor((now.getTime() - new Date(task.dueDate!).getTime()) / (1000 * 60 * 60 * 24)));

      if (nextEscalation) {
        // Escalate to next employee
        await prisma.task.update({
          where: { id: task.id },
          data: {
            assigneeId: nextEscalation.userId,
            assignedAt: now,
            escalationLevel: nextLevel,
            lastEscalatedAt: now,
          },
        });

        // Create TaskAssignment
        await prisma.taskAssignment.upsert({
          where: { taskId_userId: { taskId: task.id, userId: nextEscalation.userId } },
          create: { taskId: task.id, userId: nextEscalation.userId },
          update: {},
        });

        // Notify the new assignee
        await prisma.notification.create({
          data: {
            userId: nextEscalation.userId,
            type: "ESCALATION_ALERT",
            message: `تصعيد مهمة متأخرة: "${task.title}" — المشروع: ${task.project?.name || "—"} — العميل: ${task.project?.client?.name || "—"} — المنفذ السابق: ${previousAssigneeName} — تأخير: ${daysOverdue} يوم`,
            link: "/dashboard/my-tasks",
          },
        });

        // Notify all admins/managers
        const levelLabel = nextLevel === 1 ? "أول" : nextLevel === 2 ? "ثاني" : nextLevel === 3 ? "ثالث" : `رقم ${nextLevel}`;
        if (managerIds.length > 0) {
          await prisma.notification.createMany({
            data: managerIds.map((uid) => ({
              userId: uid,
              type: "ESCALATION_ALERT" as const,
              message: `تصعيد مهمة متأخرة — "${task.title}" — الخدمة: ${task.service?.name || "—"} — المشروع: ${task.project?.name || "—"} — العميل: ${task.project?.client?.name || "—"} — المنفذ السابق: ${previousAssigneeName} — المنفذ الجديد: ${nextEscalation.user.name} — مستوى التصعيد: ${levelLabel} — تأخير: ${daysOverdue} يوم`,
              link: `/dashboard/projects/${task.project?.id || ""}`,
            })),
          });
        }

        escalatedCount++;
      } else if (currentLevel < escalationChain.length) {
        // We've exhausted all escalation levels — final alert
        await prisma.task.update({
          where: { id: task.id },
          data: {
            escalationLevel: escalationChain.length + 1,
            lastEscalatedAt: now,
          },
        });

        // Final escalation alert to managers
        if (managerIds.length > 0) {
          await prisma.notification.createMany({
            data: managerIds.map((uid) => ({
              userId: uid,
              type: "ESCALATION_ALERT" as const,
              message: `تصعيد نهائي — مهمة بدون منفذ متاح: "${task.title}" — الخدمة: ${task.service?.name || "—"} — المشروع: ${task.project?.name || "—"} — العميل: ${task.project?.client?.name || "—"} — تأخير: ${daysOverdue} يوم — يجب التدخل اليدوي`,
              link: `/dashboard/projects/${task.project?.id || ""}`,
            })),
          });
        }

        escalatedCount++;
      }
      // If currentLevel > escalationChain.length, final alert was already sent — skip
    }

    return NextResponse.json({
      escalated: escalatedCount,
      checked: overdueTasks.length,
      message: `تم تصعيد ${escalatedCount} مهمة من أصل ${overdueTasks.length} مهمة متأخرة`,
    });
  } catch (error) {
    console.error("Escalation error:", error);
    return NextResponse.json({ error: "حدث خطأ في التصعيد" }, { status: 500 });
  }
}

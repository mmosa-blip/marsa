/**
 * Task Assignment System — Single Assignee with Acceptance & Rejection
 *
 * Rules:
 * 1. Each task is assigned to ONE executor (assigneeId)
 * 2. Priority: oldest project first → least active tasks → round-robin
 * 3. Task must be accepted within 2 hours or auto-reassigned
 * 4. Rejected tasks go to next qualified executor (excluding previous rejectors)
 * 5. If all qualified reject, task goes to admin (assigneeId = null)
 */
import { prisma } from "@/lib/prisma";
import { createNotification, createNotifications } from "@/lib/notifications";

const ACCEPTANCE_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 hours

interface PickAssigneeOptions {
  qualifiedUserIds: string[];
  excludeUserIds?: string[];
  projectId: string;
  fallbackIndex?: number;
}

/**
 * Pick the best executor for a task based on:
 * 1. Oldest project first (natural order — projects created earlier come first)
 * 2. Least active tasks (TODO/IN_PROGRESS/IN_REVIEW/WAITING) — load balancing
 * 3. Round-robin via fallbackIndex as tiebreaker
 */
export async function pickNextAssignee(opts: PickAssigneeOptions): Promise<string | null> {
  const excluded = new Set(opts.excludeUserIds || []);
  const candidates = opts.qualifiedUserIds.filter((id) => !excluded.has(id));

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  // Count active tasks per candidate (load balancing)
  const activeCounts = await prisma.task.groupBy({
    by: ["assigneeId"],
    where: {
      assigneeId: { in: candidates },
      status: { in: ["TODO", "IN_PROGRESS", "IN_REVIEW", "WAITING"] },
      project: { deletedAt: null },
    },
    _count: { assigneeId: true },
  });

  const countMap = new Map<string, number>();
  for (const c of activeCounts) {
    if (c.assigneeId) countMap.set(c.assigneeId, c._count.assigneeId);
  }

  // Find minimum count
  let minCount = Infinity;
  const tiebreakers: string[] = [];
  for (const userId of candidates) {
    const count = countMap.get(userId) ?? 0;
    if (count < minCount) {
      minCount = count;
      tiebreakers.length = 0;
      tiebreakers.push(userId);
    } else if (count === minCount) {
      tiebreakers.push(userId);
    }
  }

  // Tiebreaker: round-robin via fallbackIndex
  const idx = (opts.fallbackIndex || 0) % tiebreakers.length;
  return tiebreakers[idx];
}

/**
 * Assign a task to the next qualified executor (used on rejection or initial assignment).
 * Returns the new assignee ID or null if no candidates available.
 */
export async function reassignTask(taskId: string): Promise<string | null> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      service: {
        include: {
          serviceTemplate: {
            include: { qualifiedEmployees: true },
          },
        },
      },
      rejections: { select: { providerId: true } },
    },
  });

  if (!task || !task.service?.serviceTemplate) return null;

  const qualifiedIds = task.service.serviceTemplate.qualifiedEmployees.map((e) => e.userId);
  if (qualifiedIds.length === 0) return null;

  const rejectedIds = task.rejections.map((r) => r.providerId);

  // Also exclude the current assignee (in case they were removed without rejection)
  const excludeIds = [...rejectedIds];
  if (task.assigneeId) excludeIds.push(task.assigneeId);

  const nextAssignee = await pickNextAssignee({
    qualifiedUserIds: qualifiedIds,
    excludeUserIds: excludeIds,
    projectId: task.projectId,
    fallbackIndex: rejectedIds.length, // rotate on each rejection
  });

  if (!nextAssignee) {
    // All qualified employees rejected — notify admins for manual assignment
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN", isActive: true, deletedAt: null },
      select: { id: true },
    });
    await createNotifications(
      admins.map((a) => ({
        userId: a.id,
        type: "TASK_REJECTED" as const,
        message: `رفض جميع المنفذين المهمة: ${task.title} — يحتاج تعيين يدوي`,
        link: `/dashboard/projects/${task.projectId}`,
      }))
    );
    await prisma.task.update({
      where: { id: taskId },
      data: { assigneeId: null, assignedAt: null, acceptedAt: null },
    });
    return null;
  }

  // Assign to the new executor (pending acceptance)
  await prisma.task.update({
    where: { id: taskId },
    data: {
      assigneeId: nextAssignee,
      assignedAt: new Date(),
      acceptedAt: null, // reset — must accept again
    },
  });

  // Sync TaskAssignment
  await prisma.taskAssignment.upsert({
    where: { taskId_userId: { taskId, userId: nextAssignee } },
    create: { taskId, userId: nextAssignee },
    update: {},
  });

  // Notify new assignee
  await createNotification({
    userId: nextAssignee,
    type: "NEW_TASK",
    message: `تم تعيينك لمهمة جديدة: ${task.title} — اقبل أو ارفض خلال ساعتين`,
    link: "/dashboard/my-tasks",
  });

  return nextAssignee;
}

/**
 * Check for stale (unaccepted) tasks and auto-reassign them.
 * Called opportunistically from my-tasks endpoints.
 *
 * Criteria: assigneeId set + assignedAt > 2 hours ago + acceptedAt is null
 */
export async function reassignStaleTasks(): Promise<number> {
  const twoHoursAgo = new Date(Date.now() - ACCEPTANCE_TIMEOUT_MS);

  const stale = await prisma.task.findMany({
    where: {
      assigneeId: { not: null },
      assignedAt: { lt: twoHoursAgo },
      acceptedAt: null,
      status: { in: ["TODO", "WAITING"] },
    },
    select: { id: true, assigneeId: true },
  });

  let reassigned = 0;
  for (const task of stale) {
    // Record implicit rejection (unaccepted timeout)
    if (task.assigneeId) {
      try {
        await prisma.taskRejection.create({
          data: {
            taskId: task.id,
            providerId: task.assigneeId,
            reason: "انتهت المهلة — لم يتم القبول خلال ساعتين",
          },
        });
      } catch {}
    }

    const newAssignee = await reassignTask(task.id);
    if (newAssignee) reassigned++;
  }

  return reassigned;
}

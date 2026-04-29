import { prisma } from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher";
import { projectAssignedMessage } from "@/lib/project-tips";
import { getEffectiveDeadline } from "@/lib/project-deadline";
import { logger } from "@/lib/logger";

// Type for notification type - use string literal union to avoid import issues
type NotifType =
  | "NEW_TASK"
  | "TASK_UPDATE"
  | "PROJECT_STATUS_CHANGE"
  | "INVOICE_DUE"
  | "INVOICE_PAID"
  | "REMINDER_UPCOMING"
  | "DOCUMENT_EXPIRING"
  | "NEW_MESSAGE"
  | "PAYMENT_REQUEST_UPDATE"
  | "TASK_REJECTED"
  | "TASK_TRANSFER_REQUEST"
  | "TASK_TRANSFER_APPROVED"
  | "TASK_TRANSFER_REJECTED"
  | "ESCALATION_ALERT"
  | "PROJECT_ASSIGNED";

/**
 * Create a notification for a user
 */
export async function createNotification({
  userId,
  type,
  message,
  link,
}: {
  userId: string;
  type: NotifType;
  message: string;
  link: string;
}) {
  const notification = await prisma.notification.create({
    data: { userId, type, message, link },
  });

  // Trigger real-time notification via Pusher
  try {
    await pusherServer.trigger(
      `private-user-${userId}`,
      "new-notification",
      notification
    );
  } catch (error) {
    console.error("Pusher trigger error (createNotification):", error);
  }

  return notification;
}

/**
 * Create notifications for multiple users
 */
export async function createNotifications(
  notifications: {
    userId: string;
    type: NotifType;
    message: string;
    link: string;
  }[]
) {
  // Use createMany for bulk insert
  await prisma.notification.createMany({
    data: notifications,
  });

  // Trigger real-time notifications for each unique user
  const uniqueUserIds = [...new Set(notifications.map((n) => n.userId))];
  for (const userId of uniqueUserIds) {
    const userNotification = notifications.find((n) => n.userId === userId);
    if (userNotification) {
      try {
        await pusherServer.trigger(
          `private-user-${userId}`,
          "new-notification",
          {
            type: userNotification.type,
            message: userNotification.message,
            link: userNotification.link,
            userId,
            createdAt: new Date().toISOString(),
            isRead: false,
          }
        );
      } catch (error) {
        console.error("Pusher trigger error (createNotifications):", error);
      }
    }
  }
}

/**
 * Get unread notification count for a user
 */
export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({
    where: { userId, isRead: false },
  });
}

/**
 * Send a rich PROJECT_ASSIGNED notification to one or more recipients.
 *
 * Loads the project (client + per-recipient task count) once, computes the
 * effective deadline, then formats the same body via projectAssignedMessage
 * for each user. Best-effort: failures are logged and swallowed so a flaky
 * notification never rolls back the assignment that triggered it.
 *
 * Dedupes recipients and skips the sender (typical case: ADMIN/MANAGER who
 * just assigned themselves doesn't need to be notified about it).
 */
export async function notifyProjectAssignment(args: {
  projectId: string;
  userIds: string[];
  excludeUserId?: string;
}): Promise<void> {
  const recipients = Array.from(new Set(args.userIds)).filter(
    (uid) => uid && uid !== args.excludeUserId
  );
  if (recipients.length === 0) return;

  try {
    const project = await prisma.project.findUnique({
      where: { id: args.projectId },
      select: {
        id: true,
        name: true,
        projectCode: true,
        startDate: true,
        endDate: true,
        contractEndDate: true,
        contract: { select: { endDate: true } },
        client: { select: { name: true } },
      },
    });
    if (!project) return;

    const deadline = getEffectiveDeadline(project);

    // Per-recipient task count: tasks they own in this project right now.
    const taskCounts = await prisma.task.groupBy({
      by: ["assigneeId"],
      where: {
        service: { projectId: project.id, deletedAt: null },
        assigneeId: { in: recipients },
        deletedAt: null,
      },
      _count: { _all: true },
    });
    const countByUser = Object.fromEntries(
      taskCounts.map((g) => [g.assigneeId ?? "", g._count._all])
    );

    await createNotifications(
      recipients.map((uid) => ({
        userId: uid,
        type: "PROJECT_ASSIGNED" as const,
        message: projectAssignedMessage({
          projectName: project.name,
          projectCode: project.projectCode,
          clientName: project.client?.name ?? null,
          startDate: project.startDate,
          endDate: deadline,
          taskCount: countByUser[uid] ?? 0,
        }),
        link: `/dashboard/projects/${project.id}`,
      }))
    );
  } catch (e) {
    logger.warn("notifyProjectAssignment failed", {
      projectId: args.projectId,
      e: String(e),
    });
  }
}

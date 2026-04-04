import { prisma } from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher";

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
  | "TASK_TRANSFER_REJECTED";

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

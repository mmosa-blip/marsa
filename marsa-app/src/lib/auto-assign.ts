import { prisma } from "@/lib/prisma";
import { createNotification, createNotifications } from "@/lib/notifications";

export async function autoAssignTask(
  taskId: string,
  serviceTemplateId: string
) {
  // 1. Find all active ServiceProviderMapping records for the given serviceTemplateId
  const mappings = await prisma.serviceProviderMapping.findMany({
    where: {
      serviceTemplateId,
      isActive: true,
      provider: {
        isActive: true,
      },
    },
    include: {
      provider: true,
    },
    orderBy: {
      priority: "asc",
    },
  });

  // 2. No mappings found — notify all admins
  if (mappings.length === 0) {
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN" },
      select: { id: true },
    });

    await createNotifications(
      admins.map((admin) => ({
        userId: admin.id,
        type: "NEW_TASK" as const,
        message: "مهمة جديدة بدون مزود مؤهل",
        link: "/dashboard/projects",
      }))
    );

    return;
  }

  let selectedProviderId: string;

  if (mappings.length === 1) {
    // 3. Exactly one mapping — assign directly
    selectedProviderId = mappings[0].providerId;
  } else {
    // 4. Multiple mappings — find provider with least IN_PROGRESS tasks
    const providerIds = mappings.map((m) => m.providerId);

    const inProgressCounts = await prisma.task.groupBy({
      by: ["assigneeId"],
      where: {
        assigneeId: { in: providerIds },
        status: "IN_PROGRESS",
      },
      _count: {
        assigneeId: true,
      },
    });

    const countMap = new Map<string, number>();
    for (const entry of inProgressCounts) {
      if (entry.assigneeId) {
        countMap.set(entry.assigneeId, entry._count.assigneeId);
      }
    }

    // Find minimum count, then pick the one with lowest priority number on tie
    let bestMapping = mappings[0];
    let bestCount = countMap.get(bestMapping.providerId) ?? 0;

    for (let i = 1; i < mappings.length; i++) {
      const mapping = mappings[i];
      const count = countMap.get(mapping.providerId) ?? 0;

      if (
        count < bestCount ||
        (count === bestCount && mapping.priority < bestMapping.priority)
      ) {
        bestMapping = mapping;
        bestCount = count;
      }
    }

    selectedProviderId = bestMapping.providerId;
  }

  // Assign the task to the selected provider
  await prisma.task.update({
    where: { id: taskId },
    data: { assigneeId: selectedProviderId },
  });

  // 5. Notify the assigned provider
  await createNotification({
    userId: selectedProviderId,
    type: "NEW_TASK",
    message: "تم تعيينك لمهمة جديدة",
    link: "/dashboard/projects",
  });
}

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createNotification, createNotifications } from "@/lib/notifications";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ expired: 0 });
    }

    const now = new Date();

    // Find all pending transfers that have expired
    const expiredTransfers = await prisma.taskTransferRequest.findMany({
      where: {
        status: { in: ["PENDING_ADMIN", "PENDING_TARGET"] },
        autoExpired: false,
        expiresAt: { not: null, lt: now },
      },
      include: {
        task: { select: { title: true } },
        requester: { select: { id: true, name: true } },
        targetUser: { select: { id: true, name: true } },
      },
    });

    if (expiredTransfers.length === 0) {
      return NextResponse.json({ expired: 0 });
    }

    // Mark them as expired
    await prisma.taskTransferRequest.updateMany({
      where: {
        id: { in: expiredTransfers.map((t) => t.id) },
      },
      data: {
        autoExpired: true,
        status: "CANCELLED",
      },
    });

    // Notify requesters
    for (const tr of expiredTransfers) {
      const phaseLabel = tr.status === "PENDING_ADMIN" ? "موافقة الإدارة" : "قبول المستهدف";
      await createNotification({
        userId: tr.requesterId,
        type: "TASK_UPDATE",
        message: `انتهت مهلة طلب تحويل المهمة "${tr.task.title}" — مرحلة: ${phaseLabel}`,
        link: "/dashboard/task-transfers",
      });

      // Notify admins if it expired at PENDING_ADMIN
      if (tr.status === "PENDING_ADMIN") {
        const admins = await prisma.user.findMany({
          where: { role: { in: ["ADMIN", "MANAGER"] }, isActive: true, deletedAt: null },
          select: { id: true },
        });
        if (admins.length > 0) {
          await createNotifications(
            admins.map((a) => ({
              userId: a.id,
              type: "TASK_UPDATE" as const,
              message: `انتهت مهلة طلب تحويل المهمة "${tr.task.title}" (${tr.urgency === "URGENT" ? "عاجل" : "عادي"})`,
              link: "/dashboard/task-transfers",
            }))
          );
        }
      }

      // Notify target if it expired at PENDING_TARGET
      if (tr.status === "PENDING_TARGET") {
        await createNotification({
          userId: tr.targetUser.id,
          type: "TASK_UPDATE",
          message: `انتهت مهلة قبولك لطلب تحويل المهمة "${tr.task.title}"`,
          link: "/dashboard/task-transfers",
        });
      }
    }

    return NextResponse.json({ expired: expiredTransfers.length });
  } catch (error) {
    console.error("[check-expired] Error:", error);
    return NextResponse.json({ expired: 0 });
  }
}

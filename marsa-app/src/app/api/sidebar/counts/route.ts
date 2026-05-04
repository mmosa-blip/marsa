import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({
        chat: 0,
        reminders: 0,
        serviceRequests: 0,
        taskTransfers: 0,
        contracts: 0,
      });
    }

    const userId = session.user.id;
    const role = session.user.role;
    const isAdmin = ["ADMIN", "MANAGER"].includes(role);

    // Run all counts in parallel
    const [
      chatCount,
      remindersCount,
      serviceRequestsCount,
      taskTransfersCount,
      contractsCount,
    ] = await Promise.all([
      // 1. Chat — unread messages count
      (async () => {
        const conversations = await prisma.conversation.findMany({
          where: { users: { some: { id: userId } } },
          select: { id: true },
        });
        if (conversations.length === 0) return 0;
        const convIds = conversations.map((c) => c.id);
        return prisma.message.count({
          where: {
            conversationId: { in: convIds },
            senderId: { not: userId },
            NOT: { seen: { some: { id: userId } } },
          },
        });
      })(),

      // 2. Reminders — pending or overdue (ADMIN/MANAGER only, CLIENT sees own)
      (async () => {
        if (role === "CLIENT") {
          return prisma.reminder.count({
            where: {
              clientId: userId,
              status: { in: ["PENDING", "NOTIFIED"] },
              dueDate: { lte: new Date() },
            },
          });
        }
        if (isAdmin) {
          return prisma.reminder.count({
            where: {
              status: { in: ["PENDING", "NOTIFIED"] },
              dueDate: { lte: new Date() },
            },
          });
        }
        return 0;
      })(),

      // 3. Service requests — pending
      (async () => {
        if (isAdmin) {
          return prisma.serviceRequest.count({
            where: { status: { in: ["PENDING", "REVIEWING"] } },
          });
        }
        if (role === "EXECUTOR") {
          return prisma.serviceRequest.count({
            where: { assignedToId: userId, status: { in: ["APPROVED", "IN_PROGRESS"] } },
          });
        }
        if (role === "CLIENT") {
          return prisma.serviceRequest.count({
            where: { clientId: userId, status: { in: ["AWAITING_PAYMENT", "REVIEWING"] } },
          });
        }
        return 0;
      })(),

      // 4. Task transfers — pending
      (async () => {
        if (isAdmin) {
          return prisma.taskTransferRequest.count({
            where: { status: "PENDING_ADMIN" },
          });
        }
        return prisma.taskTransferRequest.count({
          where: { status: "PENDING_TARGET", targetUserId: userId },
        });
      })(),


      // 7. Contracts — pending review/signature
      (async () => {
        if (isAdmin) {
          return prisma.contract.count({
            where: { status: { in: ["PENDING_APPROVAL", "SENT_TO_CLIENT"] } },
          });
        }
        if (role === "CLIENT") {
          return prisma.contract.count({
            where: { clientId: userId, status: "SENT_TO_CLIENT" },
          });
        }
        return 0;
      })(),
    ]);

    return NextResponse.json({
      chat: chatCount,
      reminders: remindersCount,
      serviceRequests: serviceRequestsCount,
      taskTransfers: taskTransfersCount,
      contracts: contractsCount,
    });
  } catch (error) {
    console.error("[sidebar/counts] Error:", error);
    return NextResponse.json({
      chat: 0,
      reminders: 0,
      serviceRequests: 0,
      taskTransfers: 0,
      contracts: 0,
    });
  }
}

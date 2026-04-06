import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const userId = session.user.id;
    const userRole = session.user.role;
    const isExternalProvider = userRole === "EXTERNAL_PROVIDER";

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);
    const weekEnd = new Date(todayStart);
    weekEnd.setDate(weekEnd.getDate() + 8);

    const includeRelations = {
      service: { select: { id: true, name: true } },
      project: {
        select: {
          id: true,
          name: true,
          ...(!isExternalProvider && {
            client: { select: { id: true, name: true } },
          }),
        },
      },
    };

    const baseFindArgs = {
      where: {
        OR: [
          { assigneeId: userId },
          { assignments: { some: { userId } } },
          { service: { executors: { some: { userId } } } },
          { service: { serviceTemplate: { qualifiedEmployees: { some: { userId } } } } },
        ],
        status: { notIn: ["DONE" as const, "CANCELLED" as const] },
      },
      include: includeRelations,
      orderBy: { dueDate: "asc" as const },
    };

    const overdue = await prisma.task.findMany({
      ...baseFindArgs,
      where: {
        ...baseFindArgs.where,
        dueDate: { lt: todayStart },
      },
    });

    const today = await prisma.task.findMany({
      ...baseFindArgs,
      where: {
        ...baseFindArgs.where,
        dueDate: { gte: todayStart, lt: todayEnd },
      },
    });

    const thisWeek = await prisma.task.findMany({
      ...baseFindArgs,
      where: {
        ...baseFindArgs.where,
        dueDate: { gte: todayEnd, lt: weekEnd },
      },
    });

    const later = await prisma.task.findMany({
      ...baseFindArgs,
      where: {
        ...baseFindArgs.where,
        dueDate: { gte: weekEnd },
      },
    });

    return NextResponse.json({
      overdue,
      today,
      thisWeek,
      later,
      stats: {
        overdue: overdue.length,
        today: today.length,
        thisWeek: thisWeek.length,
        later: later.length,
      },
    });
  } catch (error) {
    console.error("Error fetching my tasks:", error);
    return NextResponse.json(
      { error: "حدث خطأ في جلب المهام" },
      { status: 500 }
    );
  }
}

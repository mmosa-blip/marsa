import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (
      !session ||
      !["ADMIN", "MANAGER"].includes(session.user.role)
    ) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    const now = new Date();
    const from = fromParam
      ? new Date(fromParam)
      : new Date(now.getFullYear(), now.getMonth() - 6, 1);
    const to = toParam ? new Date(toParam) : now;

    // Get all executors and external providers
    const users = await prisma.user.findMany({
      where: {
        role: { in: ["EXECUTOR", "EXTERNAL_PROVIDER"] },
        isActive: true,
      },
      select: { id: true, name: true, role: true },
    });

    // Get all tasks in the date range assigned to these users
    const tasks = await prisma.task.findMany({
      where: {
        assigneeId: { in: users.map((u) => u.id) },
        createdAt: { gte: from, lte: to },
      },
      select: {
        id: true,
        status: true,
        assigneeId: true,
        dueDate: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Build executor performance
    const executors = users.map((user) => {
      const userTasks = tasks.filter((t) => t.assigneeId === user.id);
      const totalTasks = userTasks.length;
      const completedTasks = userTasks.filter((t) => t.status === "DONE").length;
      const inProgressTasks = userTasks.filter(
        (t) => t.status === "IN_PROGRESS"
      ).length;
      const rejectedTasks = userTasks.filter(
        (t) => t.status === "CANCELLED"
      ).length;

      const doneTasks = userTasks.filter((t) => t.status === "DONE");
      const avgCompletionDays =
        doneTasks.length > 0
          ? Math.round(
              doneTasks.reduce((sum, t) => {
                const diff =
                  (new Date(t.updatedAt).getTime() -
                    new Date(t.createdAt).getTime()) /
                  (1000 * 60 * 60 * 24);
                return sum + diff;
              }, 0) / doneTasks.length
            )
          : 0;

      const completionRate =
        totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      return {
        id: user.id,
        name: user.name,
        role: user.role,
        totalTasks,
        completedTasks,
        inProgressTasks,
        rejectedTasks,
        avgCompletionDays,
        completionRate,
      };
    });

    // Task efficiency: on time vs late
    const completedWithDue = tasks.filter(
      (t) => t.status === "DONE" && t.dueDate
    );
    const onTime = completedWithDue.filter(
      (t) => new Date(t.updatedAt) <= new Date(t.dueDate!)
    ).length;
    const late = completedWithDue.filter(
      (t) => new Date(t.updatedAt) > new Date(t.dueDate!)
    ).length;

    const taskEfficiency = {
      onTime,
      late,
      total: completedWithDue.length,
    };

    return NextResponse.json({ executors, taskEfficiency });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/branch/overview
// BRANCH_MANAGER only — returns subordinate executors with their
// project stats and late-task counts.
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }
    if (!["BRANCH_MANAGER", "ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const now = new Date();

    // BRANCH_MANAGER sees only their own subordinates; ADMIN/MANAGER
    // can see all branch teams via ?all=true if needed in the future.
    const subordinates = await prisma.user.findMany({
      where: {
        supervisorUserId: session.user.id,
        isActive: true,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        assignedTasks: {
          where: { deletedAt: null },
          select: {
            id: true,
            status: true,
            dueDate: true,
            project: {
              select: { id: true, name: true, projectCode: true, status: true },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    const result = subordinates.map((sub) => {
      const tasks = sub.assignedTasks;
      const totalTasks = tasks.length;
      const doneTasks = tasks.filter((t) => t.status === "DONE").length;
      const lateTasks = tasks.filter(
        (t) =>
          t.dueDate &&
          new Date(t.dueDate) < now &&
          t.status !== "DONE" &&
          t.status !== "CANCELLED"
      ).length;
      const activeTasks = tasks.filter((t) =>
        ["TODO", "IN_PROGRESS", "WAITING", "IN_REVIEW"].includes(t.status)
      ).length;

      // Distinct projects
      const projectMap = new Map<string, { id: string; name: string; projectCode: string | null; status: string }>();
      for (const t of tasks) {
        if (t.project && !projectMap.has(t.project.id)) {
          projectMap.set(t.project.id, t.project);
        }
      }

      return {
        id: sub.id,
        name: sub.name,
        phone: sub.phone,
        role: sub.role,
        totalTasks,
        doneTasks,
        activeTasks,
        lateTasks,
        projects: Array.from(projectMap.values()),
      };
    });

    return NextResponse.json(result);
  } catch (e) {
    console.error("branch/overview error:", e);
    return NextResponse.json({ error: "فشل التحميل" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "غير مسجل الدخول" }, { status: 401 });
    }
    if (session.user.role !== "CLIENT") {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const userId = session.user.id;

    const projects = await prisma.project.findMany({
      where: { clientId: userId, deletedAt: null },
      include: {
        // Only task status for progress calculation — no titles, assignees, or notes
        tasks: { select: { status: true } },
        // Service names are safe to show clients
        services: { select: { name: true, status: true } },
        department: { select: { name: true, color: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Return only client-safe fields
    const result = projects.map((p) => {
      const totalTasks = p.tasks.length;
      const completedTasks = p.tasks.filter((t) => t.status === "DONE").length;
      const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      // Determine overall status label
      const inProgress = p.tasks.filter((t) => t.status === "IN_PROGRESS").length;
      const waiting = p.tasks.filter((t) => ["WAITING", "WAITING_EXTERNAL"].includes(t.status)).length;

      return {
        id: p.id,
        name: p.name,
        description: p.description,
        status: p.status,
        priority: p.priority,
        startDate: p.startDate,
        endDate: p.endDate,
        createdAt: p.createdAt,
        progress,
        services: p.services,
        department: p.department,
        taskSummary: { total: totalTasks, done: completedTasks, inProgress, waiting },
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

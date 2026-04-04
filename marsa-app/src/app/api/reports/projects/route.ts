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

    // Fetch projects in date range
    const projectsData = await prisma.project.findMany({
      where: {
        deletedAt: null,
        createdAt: { gte: from, lte: to },
      },
      include: {
        client: { select: { name: true } },
        tasks: { select: { id: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const projects = projectsData.map((p) => {
      const totalTasks = p.tasks.length;
      const completedTasks = p.tasks.filter((t) => t.status === "DONE").length;
      const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      return {
        id: p.id,
        name: p.name,
        status: p.status,
        client: p.client.name,
        startDate: p.startDate,
        endDate: p.endDate,
        totalTasks,
        completedTasks,
        progress,
        priority: p.priority,
      };
    });

    // Status distribution
    const statusDistribution = {
      DRAFT: 0,
      ACTIVE: 0,
      ON_HOLD: 0,
      COMPLETED: 0,
      CANCELLED: 0,
    };
    for (const p of projectsData) {
      if (p.status in statusDistribution) {
        statusDistribution[p.status as keyof typeof statusDistribution]++;
      }
    }

    // Timeline data for Gantt chart
    const timeline = projectsData
      .filter((p) => p.startDate || p.endDate)
      .map((p) => {
        const totalTasks = p.tasks.length;
        const completedTasks = p.tasks.filter((t) => t.status === "DONE").length;
        const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

        return {
          id: p.id,
          name: p.name,
          startDate: p.startDate || p.createdAt,
          endDate: p.endDate || new Date(new Date(p.startDate || p.createdAt).getTime() + 30 * 24 * 60 * 60 * 1000),
          progress,
          status: p.status,
        };
      });

    return NextResponse.json({ projects, statusDistribution, timeline });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

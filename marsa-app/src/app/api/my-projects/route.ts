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
        manager: { select: { name: true } },
        tasks: { select: { status: true } },
        services: { select: { name: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const result = projects.map((p) => {
      const totalTasks = p.tasks.length;
      const completedTasks = p.tasks.filter((t) => t.status === "DONE").length;
      const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
      return {
        ...p,
        progress,
        totalTasks,
        completedTasks,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

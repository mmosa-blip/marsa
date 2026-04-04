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

    const userId = session.user.id;
    const userRole = session.user.role;

    // For executors/providers: return linked services via UserService
    if (userRole === "EXECUTOR" || userRole === "EXTERNAL_PROVIDER") {
      const userServices = await prisma.userService.findMany({
        where: { userId },
        include: { service: { select: { id: true, name: true, category: true } } },
      });
      return NextResponse.json(userServices);
    }

    // For clients: return services where they are the client
    if (userRole !== "CLIENT") {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const services = await prisma.service.findMany({
      where: { clientId: userId },
      include: {
        project: { select: { name: true, status: true } },
        tasks: { select: { status: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const result = services.map((s) => {
      const totalTasks = s.tasks.length;
      const completedTasks = s.tasks.filter((t) => t.status === "DONE").length;
      const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
      return {
        ...s,
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

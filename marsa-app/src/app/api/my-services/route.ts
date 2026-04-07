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

    // For executors/providers: return services where the user is linked
    // either via UserService (manual admin link) OR via Task.assigneeId
    // (auto-distributed by project-instantiation / redistributeTasks).
    // The UserService-only query missed every executor whose tasks were
    // assigned by the qualified-employees / project-generation paths.
    if (userRole === "EXECUTOR" || userRole === "EXTERNAL_PROVIDER") {
      const services = await prisma.service.findMany({
        where: {
          deletedAt: null,
          OR: [
            { executors: { some: { userId } } },           // UserService link
            { tasks: { some: { assigneeId: userId } } },   // assigneeId on any task
          ],
        },
        select: {
          id: true,
          name: true,
          category: true,
        },
        distinct: ["id"],
      });
      return NextResponse.json(services);
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

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role === "CLIENT") {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const { id } = await params;

    const department = await prisma.department.findUnique({
      where: { id },
      select: { id: true, name: true, color: true },
    });
    if (!department) return NextResponse.json({ error: "القسم غير موجود" }, { status: 404 });

    const now = new Date();

    interface HealthProject {
      id: string;
      name: string;
      projectCode: string | null;
      status: string;
      endDate: Date | null;
      createdAt: Date;
      client: { id: string; name: string } | null;
      tasks: { id: string; status: string; dueDate: Date | null }[];
      services: { id: string; status: string | null }[];
      paymentSchedule: { amount: number; status: string }[];
    }

    let projects: HealthProject[];
    try {
      projects = await prisma.project.findMany({
        where: { departmentId: id, deletedAt: null },
        include: {
          client: { select: { id: true, name: true } },
          tasks: { select: { id: true, status: true, dueDate: true } },
          paymentSchedule: { select: { amount: true, status: true } },
          services: { select: { id: true, status: true } },
        },
      }) as unknown as HealthProject[];
    } catch {
      // Fallback if paymentSchedule table doesn't exist yet
      const raw = await prisma.project.findMany({
        where: { departmentId: id, deletedAt: null },
        include: {
          client: { select: { id: true, name: true } },
          tasks: { select: { id: true, status: true, dueDate: true } },
          services: { select: { id: true, status: true } },
        },
      });
      projects = raw.map((p) => ({ ...p, paymentSchedule: [] as { amount: number; status: string }[] })) as unknown as HealthProject[];
    }

    // Calculate per-project health
    const projectHealth = projects.map((p) => {
      const totalTasks = p.tasks.length;
      const doneTasks = p.tasks.filter((t) => t.status === "DONE").length;
      const overdueTasks = p.tasks.filter(
        (t) => t.dueDate && new Date(t.dueDate) < now && t.status !== "DONE"
      ).length;
      const taskRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 100;

      const totalPayments = p.paymentSchedule.length;
      const paidPayments = p.paymentSchedule.filter((ps) => ps.status === "PAID").length;
      const overduePayments = p.paymentSchedule.filter((ps) => ps.status === "OVERDUE").length;
      const paymentRate = totalPayments > 0 ? Math.round((paidPayments / totalPayments) * 100) : 100;

      const overdueRate = totalTasks > 0 ? Math.round(((totalTasks - overdueTasks) / totalTasks) * 100) : 100;

      // Health = weighted average: tasks 40%, on-time 30%, payments 30%
      const health = Math.round(taskRate * 0.4 + overdueRate * 0.3 + paymentRate * 0.3);

      const daysRemaining = p.endDate
        ? Math.ceil((new Date(p.endDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      let statusLabel = "جاري";
      if (p.status === "COMPLETED") statusLabel = "مكتمل";
      else if (p.status === "ON_HOLD") statusLabel = "معلق";
      else if (overdueTasks > 0) statusLabel = "متأخر";

      return {
        id: p.id,
        name: p.name,
        projectCode: p.projectCode,
        client: p.client?.name || "—",
        status: p.status,
        statusLabel,
        progress: taskRate,
        health,
        healthLabel: health >= 80 ? "ممتاز" : health >= 60 ? "جيد" : "يحتاج متابعة",
        healthColor: health >= 80 ? "#059669" : health >= 60 ? "#C9A84C" : "#DC2626",
        totalTasks,
        doneTasks,
        overdueTasks,
        paymentRate,
        overduePayments,
        daysRemaining,
        createdAt: p.createdAt,
      };
    });

    // Sort by health (worst first)
    projectHealth.sort((a, b) => a.health - b.health);

    // Department-level stats
    const totalProjects = projects.length;
    const completed = projects.filter((p) => p.status === "COMPLETED").length;
    const active = projects.filter((p) => p.status === "ACTIVE").length;
    const onHold = projects.filter((p) => p.status === "ON_HOLD").length;
    const delayed = projectHealth.filter((p) => p.statusLabel === "متأخر").length;

    const avgHealth = totalProjects > 0
      ? Math.round(projectHealth.reduce((s, p) => s + p.health, 0) / totalProjects)
      : 100;

    return NextResponse.json({
      department,
      stats: {
        totalProjects,
        completed,
        active,
        delayed,
        onHold,
        avgHealth,
        healthLabel: avgHealth >= 80 ? "ممتاز" : avgHealth >= 60 ? "جيد" : "يحتاج متابعة",
        healthColor: avgHealth >= 80 ? "#059669" : avgHealth >= 60 ? "#C9A84C" : "#DC2626",
      },
      projects: projectHealth,
    });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

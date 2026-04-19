import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { countWorkingDays } from "@/lib/working-days";

interface ProjectHealth {
  id: string;
  name: string;
  clientName: string;
  status: string;
  // Task metrics
  totalTasks: number;
  doneTasks: number;
  inProgressTasks: number;
  overdueTasks: number;
  // SLA metrics
  contractStartDate: string | null;
  contractEndDate: string | null;
  contractDurationDays: number | null;
  daysElapsed: number;
  daysRemaining: number;
  // Calculated
  taskProgress: number;
  timeProgress: number;
  healthScore: number;
  healthStatus: "GREEN" | "AMBER" | "RED";
  healthLabel: string;
  // Current service
  currentServiceName: string | null;
  currentServiceProgress: number | null;
  allServicesDone: boolean;
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const userId = session.user.id;
    const role = session.user.role;
    const isAdmin = role === "ADMIN" || role === "MANAGER";

    console.log("[health] userId:", userId, "role:", role, "isAdmin:", isAdmin);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const projectWhere: any = {
      deletedAt: null,
      status: { notIn: ["CANCELLED"] },
    };

    // BRANCH_MANAGER sees projects of their subordinates
    if (role === "BRANCH_MANAGER") {
      const subordinates = await prisma.user.findMany({
        where: { supervisorUserId: userId, deletedAt: null, isActive: true },
        select: { id: true },
      });
      const subIds = subordinates.map((s) => s.id);
      if (subIds.length === 0) {
        return NextResponse.json([]);
      }
      const subProjects = await prisma.task.findMany({
        where: { assigneeId: { in: subIds }, projectId: { not: undefined } } as Record<string, unknown>,
        select: { projectId: true },
        distinct: ["projectId"],
      });
      const projectIds = subProjects.map((t) => t.projectId).filter(Boolean) as string[];
      if (projectIds.length === 0) {
        return NextResponse.json([]);
      }
      projectWhere.id = { in: projectIds };
    } else if (!isAdmin) {
      // EXECUTOR/EXTERNAL_PROVIDER see only their assigned projects
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const taskWhere: any = {
        OR: [
          { assigneeId: userId },
          { assignments: { some: { userId } } },
          { service: { executors: { some: { userId } } } },
        ],
      };
      const assignedProjects = await prisma.task.findMany({
        where: taskWhere,
        select: { projectId: true },
        distinct: ["projectId"],
      });
      const projectIds = assignedProjects.map((t) => t.projectId).filter(Boolean) as string[];

      console.log("[health] non-admin projectIds:", projectIds);

      if (projectIds.length === 0) {
        console.log("[health] returning empty — no assigned projects");
        return NextResponse.json([]);
      }
      projectWhere.id = { in: projectIds };
    }

    const projects = await prisma.project.findMany({
      where: projectWhere,
      include: {
        client: { select: { name: true } },
        tasks: {
          where: { status: { not: "CANCELLED" } },
          select: { id: true, status: true, dueDate: true },
        },
        services: {
          include: {
            tasks: {
              where: { status: { not: "CANCELLED" } },
              select: { id: true, status: true },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    console.log("[health] projects found:", projects.length, "names:", projects.map(p => p.name));
    console.log("[health] projectWhere:", JSON.stringify(projectWhere));

    const now = new Date();

    const healthData: ProjectHealth[] = projects.map((project) => {
      const totalTasks = project.tasks.length;
      const doneTasks = project.tasks.filter((t) => t.status === "DONE").length;
      const inProgressTasks = project.tasks.filter((t) => t.status === "IN_PROGRESS").length;
      const overdueTasks = project.tasks.filter(
        (t) => t.dueDate && new Date(t.dueDate) < now && t.status !== "DONE" && t.status !== "CANCELLED"
      ).length;

      const taskProgress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

      // SLA time calculation
      const startDate = project.contractStartDate || project.startDate;
      const endDate = project.contractEndDate || project.endDate;
      const durationDays = project.contractDurationDays;

      let daysElapsed = 0;
      let daysRemaining = 0;
      let timeProgress = 0;

      if (startDate) {
        daysElapsed = countWorkingDays(new Date(startDate), now);
      }

      if (endDate) {
        const dl = new Date(endDate);
        daysRemaining = dl > now ? countWorkingDays(now, dl) : 0;
      }

      const totalDays = durationDays || (startDate && endDate
        ? Math.max(1, countWorkingDays(new Date(startDate), new Date(endDate)))
        : 0);

      if (totalDays > 0) {
        timeProgress = Math.min(100, Math.round((daysElapsed / totalDays) * 100));
      }

      // Health score: compare task progress vs time progress
      // If task progress >= time progress => healthy
      // Gap determines severity
      let healthScore = 100;
      let healthStatus: "GREEN" | "AMBER" | "RED" = "GREEN";
      let healthLabel = "على المسار الصحيح";

      if (totalDays > 0 && totalTasks > 0) {
        const gap = timeProgress - taskProgress;
        healthScore = Math.max(0, Math.min(100, 100 - gap * 1.5));

        // Penalize overdue tasks
        const overdueRatio = overdueTasks / totalTasks;
        healthScore = Math.max(0, healthScore - overdueRatio * 30);

        healthScore = Math.round(healthScore);

        if (healthScore >= 70) {
          healthStatus = "GREEN";
          healthLabel = "على المسار الصحيح";
        } else if (healthScore >= 40) {
          healthStatus = "AMBER";
          healthLabel = "يحتاج انتباه";
        } else {
          healthStatus = "RED";
          healthLabel = "متأخر";
        }
      } else if (totalTasks > 0 && overdueTasks > 0) {
        // No SLA dates but has overdue tasks
        const overdueRatio = overdueTasks / totalTasks;
        healthScore = Math.round(100 - overdueRatio * 60);
        if (healthScore >= 70) {
          healthStatus = "GREEN";
          healthLabel = "على المسار الصحيح";
        } else if (healthScore >= 40) {
          healthStatus = "AMBER";
          healthLabel = "يحتاج انتباه";
        } else {
          healthStatus = "RED";
          healthLabel = "متأخر";
        }
      }

      // Current service detection
      let currentServiceName: string | null = null;
      let currentServiceProgress: number | null = null;
      let allServicesDone = false;

      const services = project.services || [];
      if (services.length > 0) {
        // Find service with IN_PROGRESS tasks
        let currentSvc = services.find((s) => s.tasks.some((t) => t.status === "IN_PROGRESS"));
        // If none, find first service with TODO tasks
        if (!currentSvc) {
          currentSvc = services.find((s) => s.tasks.some((t) => t.status === "TODO"));
        }

        if (currentSvc) {
          currentServiceName = currentSvc.name;
          const svcTotal = currentSvc.tasks.length;
          const svcDone = currentSvc.tasks.filter((t) => t.status === "DONE").length;
          currentServiceProgress = svcTotal > 0 ? Math.round((svcDone / svcTotal) * 100) : 0;
        } else {
          // All services have only DONE tasks
          allServicesDone = services.every((s) => s.tasks.length > 0 && s.tasks.every((t) => t.status === "DONE"));
        }
      }

      return {
        id: project.id,
        name: project.name,
        clientName: project.client?.name || "",
        status: project.status,
        totalTasks,
        doneTasks,
        inProgressTasks,
        overdueTasks,
        contractStartDate: (project.contractStartDate || project.startDate)?.toISOString() || null,
        contractEndDate: (project.contractEndDate || project.endDate)?.toISOString() || null,
        contractDurationDays: totalDays || null,
        daysElapsed,
        daysRemaining,
        taskProgress,
        timeProgress,
        healthScore,
        healthStatus,
        healthLabel,
        currentServiceName,
        currentServiceProgress,
        allServicesDone,
      };
    });

    // Sort: RED first, then AMBER, then GREEN
    const order = { RED: 0, AMBER: 1, GREEN: 2 };
    healthData.sort((a, b) => order[a.healthStatus] - order[b.healthStatus]);

    return NextResponse.json(healthData);
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("[health] ERROR:", err.message, err.stack);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pickInvestmentAssignee, isInvestmentDepartment } from "@/lib/investment-assign";
import { addWorkingDays } from "@/lib/working-days";
import { requireRole } from "@/lib/api-auth";

// POST /api/projects/[id]/branches
// Body: { branches: string[] } — branch names (e.g. ["كندا", "بريطانيا"])
//
// Creates one Service per branch from the "فتح فرع للشركة" service template,
// each named "فتح فرع الشركة في [name]" with all of the template's task
// templates instantiated and auto-assigned to qualified employees.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["ADMIN", "MANAGER"]);

    const { id: projectId } = await params;
    const body = await request.json();
    const branchNames: string[] = Array.isArray(body?.branches)
      ? body.branches.map((s: unknown) => String(s || "").trim()).filter(Boolean)
      : [];

    if (branchNames.length === 0) {
      return NextResponse.json({ created: 0, services: [] });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, clientId: true, departmentId: true, workflowType: true },
    });
    if (!project) {
      return NextResponse.json({ error: "المشروع غير موجود" }, { status: 404 });
    }

    // Find the branch service template (name contains "فتح فرع")
    const branchTemplate = await prisma.serviceTemplate.findFirst({
      where: {
        isActive: true,
        name: { contains: "فتح فرع" },
      },
      include: {
        category: true,
        taskTemplates: { orderBy: { sortOrder: "asc" } },
        qualifiedEmployees: true,
      },
    });

    if (!branchTemplate) {
      return NextResponse.json(
        { error: "قالب خدمة 'فتح فرع للشركة' غير موجود" },
        { status: 404 }
      );
    }

    const isInvestment = await isInvestmentDepartment(project.departmentId);
    const employees = branchTemplate.qualifiedEmployees;
    const now = new Date();
    const createdServices: { id: string; name: string; taskCount: number }[] = [];

    let fallbackCounter = 0;

    for (const branchName of branchNames) {
      // Create the service instance for this branch
      const service = await prisma.service.create({
        data: {
          name: `فتح فرع الشركة في ${branchName}`,
          description: branchTemplate.description,
          price: branchTemplate.defaultPrice,
          duration: branchTemplate.defaultDuration,
          category: branchTemplate.category?.name ?? null,
          clientId: project.clientId,
          projectId: project.id,
          status: "IN_PROGRESS",
        },
      });

      // Materialize tasks from the branch template, naming each with the branch
      let taskStart = new Date(now);
      for (let i = 0; i < branchTemplate.taskTemplates.length; i++) {
        const tt = branchTemplate.taskTemplates[i];
        const dueDate = addWorkingDays(taskStart, tt.defaultDuration);

        // Pick assignee — Investment uses its custom logic, others round-robin
        let assigneeId: string | null = null;
        if (employees.length > 0) {
          if (isInvestment) {
            assigneeId = await pickInvestmentAssignee({
              projectId: project.id,
              serviceId: service.id,
              qualifiedEmployeeIds: employees.map((e) => e.userId),
              fallbackIndex: fallbackCounter++,
            });
          } else {
            assigneeId = employees[(fallbackCounter++) % employees.length].userId;
          }
        }

        // Auto-assigned tasks start immediately (no acceptance step)
        const createdTask = await prisma.task.create({
          data: {
            title: `${tt.name} — ${branchName}`,
            status: assigneeId ? ("IN_PROGRESS" as const) : ("TODO" as const),
            priority: "MEDIUM" as const,
            order: tt.sortOrder,
            dueDate,
            serviceId: service.id,
            projectId: project.id,
            assigneeId,
            assignedAt: assigneeId ? now : null,
            acceptedAt: assigneeId ? now : null,
          },
        });

        if (assigneeId) {
          await prisma.taskAssignment.upsert({
            where: { taskId_userId: { taskId: createdTask.id, userId: assigneeId } },
            create: { taskId: createdTask.id, userId: assigneeId },
            update: {},
          });
        }

        // Sequential within the branch service
        if (branchTemplate.workflowType === "SEQUENTIAL") {
          taskStart = new Date(dueDate);
        }
      }

      createdServices.push({
        id: service.id,
        name: service.name,
        taskCount: branchTemplate.taskTemplates.length,
      });
    }

    return NextResponse.json(
      { created: createdServices.length, services: createdServices },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error creating branches:", error);
    const msg = error instanceof Error ? error.message : "حدث خطأ";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

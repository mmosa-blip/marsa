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
    if (!session || !["ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const { id } = await params;

    const template = await prisma.projectTemplate.findUnique({
      where: { id },
      include: {
        createdBy: { select: { name: true } },
        services: {
          include: {
            serviceTemplate: {
              include: {
                category: { select: { name: true } },
                taskTemplates: {
                  select: {
                    id: true,
                    name: true,
                    defaultDuration: true,
                    executionMode: true,
                    sameDay: true,
                    sortOrder: true,
                  },
                  orderBy: { sortOrder: "asc" },
                },
                _count: {
                  select: { taskTemplates: true },
                },
              },
            },
          },
          orderBy: { sortOrder: "asc" },
        },
        milestones: {
          orderBy: { order: "asc" },
        },
      },
    });

    if (!template) {
      return NextResponse.json(
        { error: "قالب المشروع غير موجود" },
        { status: 404 }
      );
    }

    // ── Compute per-service duration using the same task-level logic
    // as the service-catalog detail page: PARALLEL / sameDay tasks
    // overlap with their predecessor (take max of group), SEQUENTIAL
    // tasks add linearly.
    function computeServiceDuration(
      tasks: { defaultDuration: number; executionMode: string; sameDay: boolean; sortOrder: number }[]
    ): number {
      const sorted = [...tasks].sort((a, b) => a.sortOrder - b.sortOrder);
      let total = 0;
      for (let i = 0; i < sorted.length; i++) {
        const t = sorted[i];
        if (t.executionMode === "PARALLEL" || t.sameDay) {
          const prev = sorted[i - 1];
          if (prev) {
            total = total - prev.defaultDuration + Math.max(prev.defaultDuration, t.sameDay ? 0 : t.defaultDuration);
          } else {
            total += t.sameDay ? 0 : t.defaultDuration;
          }
        } else {
          total += t.defaultDuration;
        }
      }
      return total;
    }

    // ── Project-level total: only SEQUENTIAL services contribute
    // additively. PARALLEL and INDEPENDENT services run concurrently
    // with other services and don't extend the critical path.
    let totalDurationDays = 0;
    for (const link of template.services) {
      const tmpl = link.serviceTemplate;
      const svcDuration =
        tmpl.defaultDuration || computeServiceDuration(tmpl.taskTemplates);
      // Per-service executionMode on ProjectTemplateService
      const svcMode = (link as unknown as { executionMode?: string }).executionMode || "SEQUENTIAL";
      if (svcMode === "SEQUENTIAL") {
        totalDurationDays += svcDuration;
      }
      // PARALLEL and INDEPENDENT don't add to the total
    }

    // totalDurationDays = working days (defaultDuration on TaskTemplate
    // is defined as working days; Saudi week = 6 days, Saturday off).
    return NextResponse.json({ ...template, totalDurationDays });
  } catch (error) {
    console.error("Error fetching project template:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء جلب قالب المشروع" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, description, workflowType, isActive, services, milestones } = body;

    const existing = await prisma.projectTemplate.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "قالب المشروع غير موجود" },
        { status: 404 }
      );
    }

    if (name) {
      const existingTpl = await prisma.projectTemplate.findFirst({
        where: { name, id: { not: id } },
      });
      if (existingTpl) {
        return NextResponse.json({ error: "قالب مشروع بهذا الاسم موجود بالفعل" }, { status: 409 });
      }
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (workflowType !== undefined) updateData.workflowType = workflowType;
    if (isActive !== undefined) updateData.isActive = isActive;

    if (services && Array.isArray(services)) {
      // حذف الخدمات الحالية وإعادة إنشائها
      await prisma.projectTemplateService.deleteMany({
        where: { projectTemplateId: id },
      });

      await prisma.projectTemplateService.createMany({
        data: services.map(
          (
            s: {
              serviceTemplateId: string;
              sortOrder?: number;
              executionMode?: "SEQUENTIAL" | "PARALLEL" | "INDEPENDENT";
            },
            index: number
          ) => ({
            projectTemplateId: id,
            serviceTemplateId: s.serviceTemplateId,
            sortOrder: s.sortOrder ?? index,
            executionMode: s.executionMode || "SEQUENTIAL",
          })
        ),
      });
    }

    // Same delete-and-recreate strategy for payment milestones. Each row
    // carries title + amount + afterServiceIndex; the wizard reads these
    // verbatim into its paymentMilestones state when a project is created
    // from this template, and the POST /api/projects flow then materializes
    // them as ContractPaymentInstallment rows that gate the next service's
    // first task.
    if (milestones && Array.isArray(milestones)) {
      await prisma.projectTemplateMilestone.deleteMany({
        where: { projectTemplateId: id },
      });

      if (milestones.length > 0) {
        await prisma.projectTemplateMilestone.createMany({
          data: milestones.map(
            (
              m: { title: string; amount: number; afterServiceIndex: number; order?: number },
              index: number
            ) => ({
              projectTemplateId: id,
              title: m.title,
              amount: m.amount,
              afterServiceIndex: m.afterServiceIndex,
              order: m.order ?? index,
            })
          ),
        });
      }
    }

    const template = await prisma.projectTemplate.update({
      where: { id },
      data: updateData,
      include: {
        services: {
          include: {
            serviceTemplate: true,
          },
          orderBy: { sortOrder: "asc" },
        },
        milestones: {
          orderBy: { order: "asc" },
        },
        createdBy: { select: { name: true } },
      },
    });

    return NextResponse.json(template);
  } catch (error) {
    console.error("Error updating project template:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء تحديث قالب المشروع" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const { id } = await params;

    const existing = await prisma.projectTemplate.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "قالب المشروع غير موجود" },
        { status: 404 }
      );
    }

    await prisma.projectTemplate.delete({ where: { id } });

    return NextResponse.json({ message: "تم حذف قالب المشروع بنجاح" });
  } catch (error) {
    console.error("Error deleting project template:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء حذف قالب المشروع" },
      { status: 500 }
    );
  }
}

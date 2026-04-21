import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeServiceDuration } from "@/lib/service-duration";
import { requireRole } from "@/lib/api-auth";

export async function GET(request: Request) {
  try {
    // GET is open to EXECUTOR / BRANCH_MANAGER so they can pick
    // templates in the project-creation wizard. POST stays admin-only.
    await requireRole(["ADMIN", "MANAGER", "EXECUTOR", "BRANCH_MANAGER"]);

    const { searchParams } = new URL(request.url);
    const active = searchParams.get("active");

    const where: Record<string, unknown> = {};
    if (active === "true") {
      where.isActive = true;
    } else if (active === "false") {
      where.isActive = false;
    }

    const templates = await prisma.projectTemplate.findMany({
      where,
      include: {
        createdBy: { select: { name: true } },
        services: {
          include: {
            serviceTemplate: {
              include: {
                category: { select: { id: true, name: true, color: true } },
                taskTemplates: {
                  select: { defaultDuration: true, executionMode: true, sameDay: true, sortOrder: true },
                  orderBy: { sortOrder: "asc" },
                },
                _count: { select: { taskTemplates: true } },
              },
            },
          },
          orderBy: { sortOrder: "asc" },
        },
        milestones: {
          orderBy: { order: "asc" },
        },
        _count: {
          select: {
            services: true,
            projects: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const templatesWithDuration = templates.map((tpl) => {
      let totalDurationDays = 0;
      for (const link of tpl.services) {
        const tmpl = link.serviceTemplate;
        const svcDuration = tmpl.defaultDuration || computeServiceDuration(tmpl.taskTemplates);
        const svcMode = (link as unknown as { executionMode?: string }).executionMode || "SEQUENTIAL";
        const isBg = !!(link as unknown as { isBackground?: boolean }).isBackground;
        if (svcMode === "SEQUENTIAL" && !isBg) {
          totalDurationDays += svcDuration;
        }
      }
      return { ...tpl, totalDurationDays };
    });

    return NextResponse.json(templatesWithDuration);
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error fetching project templates:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء جلب قوالب المشاريع" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireRole(["ADMIN", "MANAGER"]);

    const body = await request.json();
    const { name, description, workflowType, isSystem, services, milestones } = body;

    if (!name) {
      return NextResponse.json(
        { error: "اسم القالب مطلوب" },
        { status: 400 }
      );
    }

    const existing = await prisma.projectTemplate.findFirst({
      where: { name },
    });
    if (existing) {
      return NextResponse.json(
        { error: "يوجد قالب مشروع بهذا الاسم مسبقاً." },
        { status: 400 }
      );
    }

    if (!services || !Array.isArray(services) || services.length === 0) {
      return NextResponse.json(
        { error: "يجب إضافة خدمة واحدة على الأقل" },
        { status: 400 }
      );
    }

    const template = await prisma.projectTemplate.create({
      data: {
        name,
        description: description || null,
        workflowType: workflowType || "SEQUENTIAL",
        isSystem: isSystem || false,
        createdById: session.user.id,
        services: {
          create: services.map(
            (
              s: {
                serviceTemplateId: string;
                sortOrder?: number;
                executionMode?: "SEQUENTIAL" | "PARALLEL" | "INDEPENDENT";
              },
              index: number
            ) => ({
              serviceTemplateId: s.serviceTemplateId,
              sortOrder: s.sortOrder ?? index,
              executionMode: s.executionMode || "SEQUENTIAL",
            })
          ),
        },
        ...(milestones && Array.isArray(milestones) && milestones.length > 0
          ? {
              milestones: {
                create: milestones.map(
                  (m: { title: string; amount: number; afterServiceIndex: number }, index: number) => ({
                    title: m.title,
                    amount: m.amount,
                    afterServiceIndex: m.afterServiceIndex,
                    order: index,
                  })
                ),
              },
            }
          : {}),
      },
      include: {
        services: {
          include: {
            serviceTemplate: {
              include: {
                category: { select: { id: true, name: true, color: true } },
                _count: { select: { taskTemplates: true } },
              },
            },
          },
          orderBy: { sortOrder: "asc" },
        },
        milestones: { orderBy: { order: "asc" } },
        createdBy: { select: { name: true } },
      },
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error creating project template:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء إنشاء قالب المشروع" },
      { status: 500 }
    );
  }
}

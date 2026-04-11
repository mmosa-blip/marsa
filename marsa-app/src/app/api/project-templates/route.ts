import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

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

    // ── Compute per-service duration using task-level PARALLEL/sameDay
    // logic, then sum only SEQUENTIAL services for the project total.
    function computeSvcDuration(
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

    const templatesWithDuration = templates.map((tpl) => {
      let totalDurationDays = 0;
      for (const link of tpl.services) {
        const tmpl = link.serviceTemplate;
        const svcDuration = tmpl.defaultDuration || computeSvcDuration(tmpl.taskTemplates);
        const svcMode = (link as unknown as { executionMode?: string }).executionMode || "SEQUENTIAL";
        if (svcMode === "SEQUENTIAL") {
          totalDurationDays += svcDuration;
        }
      }
      return { ...tpl, totalDurationDays };
    });

    return NextResponse.json(templatesWithDuration);
  } catch (error) {
    console.error("Error fetching project templates:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء جلب قوالب المشاريع" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

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
    console.error("Error creating project template:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء إنشاء قالب المشروع" },
      { status: 500 }
    );
  }
}

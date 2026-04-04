import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
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
    const { name, description } = body;

    // جلب المشروع مع خدماته
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        services: true,
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "المشروع غير موجود" },
        { status: 404 }
      );
    }

    if (project.services.length === 0) {
      return NextResponse.json(
        { error: "المشروع لا يحتوي على خدمات لإنشاء قالب" },
        { status: 400 }
      );
    }

    // البحث عن قوالب الخدمات المطابقة لكل خدمة
    const templateServices: { serviceTemplateId: string; sortOrder: number }[] = [];

    for (let i = 0; i < project.services.length; i++) {
      const service = project.services[i];

      // البحث عن قالب خدمة بنفس الاسم
      const serviceTemplate = await prisma.serviceTemplate.findFirst({
        where: { name: service.name },
      });

      if (serviceTemplate) {
        templateServices.push({
          serviceTemplateId: serviceTemplate.id,
          sortOrder: i,
        });
      }
    }

    if (templateServices.length === 0) {
      return NextResponse.json(
        { error: "لم يتم العثور على قوالب خدمات مطابقة لخدمات المشروع" },
        { status: 400 }
      );
    }

    // إنشاء قالب المشروع
    const template = await prisma.projectTemplate.create({
      data: {
        name: name || `قالب من: ${project.name}`,
        description: description || project.description || null,
        workflowType: project.workflowType,
        createdById: session.user.id,
        services: {
          create: templateServices,
        },
      },
      include: {
        services: {
          include: {
            serviceTemplate: {
              include: {
                category: { select: { name: true } },
              },
            },
          },
          orderBy: { sortOrder: "asc" },
        },
        createdBy: { select: { name: true } },
      },
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error("Error saving project as template:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء حفظ المشروع كقالب" },
      { status: 500 }
    );
  }
}

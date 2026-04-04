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
                _count: {
                  select: { taskTemplates: true },
                },
              },
            },
          },
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    if (!template) {
      return NextResponse.json(
        { error: "قالب المشروع غير موجود" },
        { status: 404 }
      );
    }

    return NextResponse.json(template);
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
    const { name, description, workflowType, isActive, services } = body;

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
          (s: { serviceTemplateId: string; sortOrder?: number }, index: number) => ({
            projectTemplateId: id,
            serviceTemplateId: s.serviceTemplateId,
            sortOrder: s.sortOrder ?? index,
          })
        ),
      });
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

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: "غير مصرح لك بالوصول" },
        { status: 401 }
      );
    }

    if (!["ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "ليس لديك صلاحية للوصول إلى هذا المورد" },
        { status: 403 }
      );
    }

    const { id } = await params;

    const template = await prisma.serviceTemplate.findUnique({
      where: { id },
      include: {
        category: true,
        department: { select: { id: true, name: true, nameEn: true, color: true } },
        taskTemplates: {
          orderBy: { sortOrder: "asc" },
        },
        qualifiedEmployees: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                role: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!template) {
      return NextResponse.json(
        { error: "قالب الخدمة غير موجود" },
        { status: 404 }
      );
    }

    return NextResponse.json(template);
  } catch (error) {
    console.error("خطأ في جلب قالب الخدمة:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء جلب قالب الخدمة" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: "غير مصرح لك بالوصول" },
        { status: 401 }
      );
    }

    if (!["ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "ليس لديك صلاحية للوصول إلى هذا المورد" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();

    if (body.workflowType && !["SEQUENTIAL", "INDEPENDENT"].includes(body.workflowType)) {
      return NextResponse.json(
        { error: "نوع سير العمل غير صالح. القيم المسموحة: SEQUENTIAL أو INDEPENDENT" },
        { status: 400 }
      );
    }

    const existing = await prisma.serviceTemplate.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "قالب الخدمة غير موجود" },
        { status: 404 }
      );
    }

    if (body.name || body.categoryId) {
      const finalName = body.name || existing.name;
      const finalCategory = body.categoryId || existing.categoryId;
      const duplicate = await prisma.serviceTemplate.findFirst({
        where: { name: finalName, categoryId: finalCategory, id: { not: id } },
      });
      if (duplicate) {
        return NextResponse.json({ error: "خدمة بهذا الاسم موجودة بالفعل في هذا التصنيف" }, { status: 409 });
      }
    }

    const template = await prisma.serviceTemplate.update({
      where: { id },
      data: body,
      include: {
        category: true,
        _count: {
          select: {
            taskTemplates: true,
            qualifiedEmployees: true,
          },
        },
      },
    });

    return NextResponse.json(template);
  } catch (error) {
    console.error("خطأ في تحديث قالب الخدمة:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء تحديث قالب الخدمة" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: "غير مصرح لك بالوصول" },
        { status: 401 }
      );
    }

    if (!["ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "ليس لديك صلاحية للوصول إلى هذا المورد" },
        { status: 403 }
      );
    }

    const { id } = await params;

    const existing = await prisma.serviceTemplate.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "قالب الخدمة غير موجود" },
        { status: 404 }
      );
    }

    // ─── Pre-checks: hard delete only when nothing references the template ───
    // Without these the prisma.delete below would crash with a P2003 FK
    // violation (Service.serviceTemplateId and ProjectTemplateService.
    // serviceTemplateId both have onDelete: Restrict), and the bare catch
    // block at the bottom would just return the generic "حدث خطأ" message
    // — leaving the admin no way to figure out *why* the delete failed.
    const liveInstances = await prisma.service.count({
      where: { serviceTemplateId: id, deletedAt: null },
    });
    if (liveInstances > 0) {
      return NextResponse.json(
        { error: `لا يمكن حذف القالب — مستخدم في ${liveInstances} مشروع نشط. احذف الخدمة من تلك المشاريع أولاً.` },
        { status: 409 }
      );
    }
    const inProjectTemplates = await prisma.projectTemplateService.count({
      where: { serviceTemplateId: id },
    });
    if (inProjectTemplates > 0) {
      return NextResponse.json(
        { error: `لا يمكن حذف القالب — مستخدم في ${inProjectTemplates} قالب مشروع. أزله من تلك القوالب أولاً.` },
        { status: 409 }
      );
    }

    await prisma.serviceTemplate.delete({
      where: { id },
    });

    return NextResponse.json(
      { message: "تم حذف قالب الخدمة بنجاح" }
    );
  } catch (error) {
    console.error("خطأ في حذف قالب الخدمة:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء حذف قالب الخدمة" },
      { status: 500 }
    );
  }
}

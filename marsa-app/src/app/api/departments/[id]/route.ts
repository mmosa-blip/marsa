import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET — single department
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

    const { id } = await params;
    const department = await prisma.department.findUnique({
      where: { id },
      include: {
        _count: {
          select: { projects: true, services: true, employees: true },
        },
      },
    });

    if (!department) return NextResponse.json({ error: "القسم غير موجود" }, { status: 404 });
    return NextResponse.json(department);
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

// PATCH — update department (admin only)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, nameEn, description, color, isActive } = body;

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name.trim();
    if (nameEn !== undefined) data.nameEn = nameEn?.trim() || null;
    if (description !== undefined) data.description = description?.trim() || null;
    if (color !== undefined) data.color = color || null;
    if (isActive !== undefined) data.isActive = isActive;

    const department = await prisma.department.update({
      where: { id },
      data,
    });

    return NextResponse.json(department);
  } catch (error) {
    console.error("Error:", error);
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "اسم القسم موجود مسبقاً" }, { status: 409 });
    }
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

// DELETE — delete department (admin only)
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const { id } = await params;

    // Check if department has active projects
    const projectCount = await prisma.project.count({
      where: { departmentId: id, deletedAt: null },
    });
    if (projectCount > 0) {
      return NextResponse.json(
        { error: `لا يمكن حذف القسم - يحتوي على ${projectCount} مشروع` },
        { status: 400 }
      );
    }

    await prisma.department.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

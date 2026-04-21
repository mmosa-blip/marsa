import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["ADMIN", "MANAGER"]);

    const { id } = await params;
    const body = await request.json();
    const { priority, isActive } = body;

    const existing = await prisma.serviceProviderMapping.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "الربط غير موجود" },
        { status: 404 }
      );
    }

    const data: Record<string, unknown> = {};
    if (priority !== undefined) data.priority = priority;
    if (isActive !== undefined) data.isActive = isActive;

    const mapping = await prisma.serviceProviderMapping.update({
      where: { id },
      data,
      include: {
        serviceTemplate: {
          include: {
            category: true,
          },
        },
        provider: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            specialization: true,
          },
        },
      },
    });

    return NextResponse.json(mapping);
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["ADMIN", "MANAGER"]);

    const { id } = await params;

    const existing = await prisma.serviceProviderMapping.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "الربط غير موجود" },
        { status: 404 }
      );
    }

    await prisma.serviceProviderMapping.delete({
      where: { id },
    });

    return NextResponse.json({ message: "تم حذف الربط بنجاح" });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

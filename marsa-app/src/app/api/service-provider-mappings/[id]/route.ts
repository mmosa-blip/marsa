import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (
      !session ||
      !["ADMIN", "MANAGER"].includes(session.user.role)
    ) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

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
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (
      !session ||
      !["ADMIN", "MANAGER"].includes(session.user.role)
    ) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

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
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

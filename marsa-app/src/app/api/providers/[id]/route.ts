import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    if (!["ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "ليس لديك صلاحية لتعديل بيانات المزود" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();

    const provider = await prisma.user.findUnique({
      where: { id },
    });

    if (!provider || provider.role !== "EXTERNAL_PROVIDER") {
      return NextResponse.json(
        { error: "مزود الخدمة غير موجود" },
        { status: 404 }
      );
    }

    const {
      name,
      email,
      phone,
      specialization,
      supervisorId,
      costPerTask,
      bankName,
      bankIban,
    } = body;

    if (email && email !== provider.email) {
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });
      if (existingUser) {
        return NextResponse.json(
          { error: "البريد الإلكتروني مستخدم بالفعل" },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(email !== undefined && { email }),
        ...(phone !== undefined && { phone }),
        ...(specialization !== undefined && { specialization }),
        ...(supervisorId !== undefined && { supervisorId }),
        ...(costPerTask !== undefined && { costPerTask }),
        ...(bankName !== undefined && { bankName }),
        ...(bankIban !== undefined && { bankIban }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        specialization: true,
        costPerTask: true,
        bankName: true,
        bankIban: true,
        isExternal: true,
        role: true,
        supervisorId: true,
        supervisor: {
          select: { id: true, name: true },
        },
        updatedAt: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating provider:", error);
    return NextResponse.json(
      { error: "حدث خطأ في تعديل بيانات المزود" },
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
    if (!session) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "فقط المدير يمكنه حذف مزود الخدمة" },
        { status: 403 }
      );
    }

    const { id } = await params;

    const provider = await prisma.user.findUnique({
      where: { id },
    });

    if (!provider || provider.role !== "EXTERNAL_PROVIDER") {
      return NextResponse.json(
        { error: "مزود الخدمة غير موجود" },
        { status: 404 }
      );
    }

    // Soft delete — never hard delete users
    await prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    return NextResponse.json({ message: "تم حذف مزود الخدمة بنجاح" });
  } catch (error) {
    console.error("Error deleting provider:", error);
    return NextResponse.json(
      { error: "حدث خطأ في حذف مزود الخدمة" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["ADMIN", "MANAGER"]);

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
      const existingUser = await prisma.user.findFirst({
        where: { email, id: { not: id } },
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
    if (error instanceof Response) return error;
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
    await requireRole(["ADMIN"]);

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
    if (error instanceof Response) return error;
    console.error("Error deleting provider:", error);
    return NextResponse.json(
      { error: "حدث خطأ في حذف مزود الخدمة" },
      { status: 500 }
    );
  }
}

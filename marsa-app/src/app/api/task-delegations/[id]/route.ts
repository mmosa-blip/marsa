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
      (session.user.role !== "ADMIN" && session.user.role !== "MANAGER")
    ) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const { id } = await params;

    const delegation = await prisma.taskTransferDelegation.findUnique({
      where: { id },
    });

    if (!delegation) {
      return NextResponse.json(
        { error: "التفويض غير موجود" },
        { status: 404 }
      );
    }

    const updated = await prisma.taskTransferDelegation.update({
      where: { id },
      data: { isActive: !delegation.isActive },
      include: {
        fromProvider: {
          select: { id: true, name: true, email: true },
        },
        toProvider: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (
      !session ||
      (session.user.role !== "ADMIN" && session.user.role !== "MANAGER")
    ) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const { id } = await params;

    const delegation = await prisma.taskTransferDelegation.findUnique({
      where: { id },
    });

    if (!delegation) {
      return NextResponse.json(
        { error: "التفويض غير موجود" },
        { status: 404 }
      );
    }

    await prisma.taskTransferDelegation.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

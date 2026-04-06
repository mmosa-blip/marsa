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
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }
    const { id } = await params;
    const body = await request.json();

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name.trim();
    if (body.description !== undefined) data.description = body.description?.trim() || null;
    if (body.displayOrder !== undefined) data.displayOrder = parseInt(String(body.displayOrder));
    if (body.isActive !== undefined) data.isActive = !!body.isActive;

    const group = await prisma.documentGroup.update({ where: { id }, data });
    return NextResponse.json(group);
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
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }
    const { id } = await params;

    // Unlink doc types from this group before deleting
    await prisma.docType.updateMany({
      where: { groupId: id },
      data: { groupId: null },
    });

    await prisma.documentGroup.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

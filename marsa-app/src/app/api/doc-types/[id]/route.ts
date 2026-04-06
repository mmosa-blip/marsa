import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const { id } = await params;
  const docType = await prisma.docType.findUnique({
    where: { id },
    include: { group: true },
  });
  if (!docType) return NextResponse.json({ error: "غير موجود" }, { status: 404 });
  return NextResponse.json(docType);
}

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
    if (body.kind !== undefined) data.kind = body.kind;
    if (body.sampleImageUrl !== undefined) data.sampleImageUrl = body.sampleImageUrl || null;
    if (body.instructions !== undefined) data.instructions = body.instructions?.trim() || null;
    if (body.fields !== undefined) data.fields = body.fields ? (typeof body.fields === "string" ? body.fields : JSON.stringify(body.fields)) : null;
    if (body.isConfidential !== undefined) data.isConfidential = !!body.isConfidential;
    if (body.whoCanUpload !== undefined) data.whoCanUpload = body.whoCanUpload;
    if (body.whoCanView !== undefined) data.whoCanView = body.whoCanView;
    if (body.isRequired !== undefined) data.isRequired = !!body.isRequired;
    if (body.displayOrder !== undefined) data.displayOrder = parseInt(String(body.displayOrder));
    if (body.groupId !== undefined) data.groupId = body.groupId || null;
    if (body.isActive !== undefined) data.isActive = !!body.isActive;

    const docType = await prisma.docType.update({ where: { id }, data });
    return NextResponse.json(docType);
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

    // Check if in use
    const count = await prisma.projectDocument.count({ where: { documentTypeId: id } });
    if (count > 0) {
      // Soft delete (deactivate) instead
      await prisma.docType.update({ where: { id }, data: { isActive: false } });
      return NextResponse.json({ deactivated: true });
    }

    await prisma.docType.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

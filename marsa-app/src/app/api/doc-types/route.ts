import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET — list document types (optionally filtered by department or group)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get("departmentId");
    const groupId = searchParams.get("groupId");

    const where: Record<string, unknown> = { isActive: true };
    if (departmentId) where.departmentId = departmentId;
    if (groupId) where.groupId = groupId;

    const types = await prisma.docType.findMany({
      where,
      include: {
        group: { select: { id: true, name: true, displayOrder: true } },
        _count: { select: { projectDocuments: true } },
      },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    });

    return NextResponse.json(types);
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

// POST — create document type (admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const body = await request.json();
    const {
      name, description, kind, sampleImageUrl, instructions, fields,
      isConfidential, whoCanUpload, whoCanView, isRequired,
      displayOrder, departmentId, groupId,
    } = body;

    if (!name?.trim()) return NextResponse.json({ error: "الاسم مطلوب" }, { status: 400 });
    if (!departmentId) return NextResponse.json({ error: "القسم مطلوب" }, { status: 400 });

    const docType = await prisma.docType.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        kind: kind || "FILE",
        sampleImageUrl: sampleImageUrl || null,
        instructions: instructions?.trim() || null,
        fields: fields ? (typeof fields === "string" ? fields : JSON.stringify(fields)) : null,
        isConfidential: !!isConfidential,
        whoCanUpload: whoCanUpload || "BOTH",
        whoCanView: whoCanView || "EXECUTORS_AND_ADMIN",
        isRequired: !!isRequired,
        displayOrder: parseInt(String(displayOrder || 0)),
        departmentId,
        groupId: groupId || null,
      },
    });

    return NextResponse.json(docType, { status: 201 });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

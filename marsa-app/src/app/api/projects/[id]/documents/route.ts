import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET — list project documents with visibility filter based on user role
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

    const { id } = await params;
    const role = session.user.role;
    const userId = session.user.id;

    // Verify user has access to the project
    const project = await prisma.project.findUnique({
      where: { id },
      select: { id: true, clientId: true, departmentId: true },
    });
    if (!project) return NextResponse.json({ error: "المشروع غير موجود" }, { status: 404 });

    const isClient = role === "CLIENT";
    if (isClient && project.clientId !== userId) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    // Build visibility filter based on role
    const visibilityFilter: Record<string, unknown>[] = [];
    if (role === "ADMIN" || role === "MANAGER") {
      // Admin/Manager sees everything
    } else if (isClient) {
      // Client sees only documents explicitly shared with them
      visibilityFilter.push({ isSharedWithClient: true });
    } else {
      // Executors: filter by docType.whoCanView
      visibilityFilter.push({
        OR: [
          { documentType: { whoCanView: "ALL" } },
          { documentType: { whoCanView: "EXECUTORS_AND_ADMIN" } },
        ],
      });
    }

    const documents = await prisma.projectDocument.findMany({
      where: {
        projectId: id,
        ...(visibilityFilter.length ? { AND: visibilityFilter } : {}),
      },
      include: {
        documentType: {
          include: { group: { select: { id: true, name: true, displayOrder: true } } },
        },
        uploadedBy: { select: { id: true, name: true } },
        reviewedBy: { select: { id: true, name: true } },
        partner: { select: { id: true, name: true, order: true } },
      },
      orderBy: [{ createdAt: "desc" }],
    });

    return NextResponse.json(documents);
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

// POST — upload a new document
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    const {
      documentTypeId, fileUrl, textData, uploadedOnBehalfOfClient,
    } = body;

    if (!documentTypeId) {
      return NextResponse.json({ error: "نوع المستند مطلوب" }, { status: 400 });
    }

    const docType = await prisma.docType.findUnique({
      where: { id: documentTypeId },
      select: { kind: true },
    });
    if (!docType) return NextResponse.json({ error: "نوع المستند غير موجود" }, { status: 404 });

    if (docType.kind === "FILE" && !fileUrl) {
      return NextResponse.json({ error: "ملف مطلوب" }, { status: 400 });
    }
    if (docType.kind === "TEXT" && !textData) {
      return NextResponse.json({ error: "البيانات مطلوبة" }, { status: 400 });
    }

    // Check existing versions for this doc type in this project
    const existing = await prisma.projectDocument.findMany({
      where: { projectId: id, documentTypeId },
      orderBy: { version: "desc" },
      take: 1,
    });
    const version = existing.length > 0 ? existing[0].version + 1 : 1;

    const doc = await prisma.projectDocument.create({
      data: {
        projectId: id,
        documentTypeId,
        kind: docType.kind,
        fileUrl: fileUrl || null,
        textData: textData ? (typeof textData === "string" ? textData : JSON.stringify(textData)) : null,
        uploadedOnBehalfOfClient: !!uploadedOnBehalfOfClient,
        status: "PENDING_REVIEW",
        version,
        uploadedById: session.user.id,
      },
    });

    return NextResponse.json(doc, { status: 201 });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

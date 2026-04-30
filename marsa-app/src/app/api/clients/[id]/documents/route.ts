import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can, PERMISSIONS } from "@/lib/permissions";
import { mirrorClientDocumentCreate } from "@/lib/record-dual-write";
import { recordItemToClientDocument } from "@/lib/record-shape-adapter";
import { logger } from "@/lib/logger";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const { id } = await params;
    const isOwn = session.user.id === id;

    // Client can view their own, others need permission
    if (!isOwn && !(await can(session.user.id, session.user.role, PERMISSIONS.CLIENTS_VIEW))) {
      return NextResponse.json({ error: "ليس لديك صلاحية" }, { status: 403 });
    }

    // ─── Phase C — read from the new record system ───────────────────
    // Reads ProjectRecordItem rows tagged [CD:...] for projects owned
    // by this client. Adapts to legacy ClientDocument shape.
    const recordItems = await prisma.projectRecordItem.findMany({
      where: {
        scope: "CLIENT",
        deletedAt: null,
        title: { contains: "[CD:" },
        project: { clientId: id },
      },
      include: {
        uploadedBy: { select: { id: true, name: true } },
        project: { select: { id: true, name: true, clientId: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    if (recordItems.length > 0) {
      const adapted = recordItems
        .map((it) => recordItemToClientDocument(it))
        .filter((x): x is NonNullable<typeof x> => x !== null);
      return NextResponse.json(adapted);
    }

    // Fallback path — legacy table only.
    logger.warn("clients/[id]/documents: no record-system rows, falling back to legacy", { clientId: id });
    const documents = await prisma.clientDocument.findMany({
      where: { clientId: id },
      include: {
        uploadedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(documents);
  } catch (error) {
    console.error("Error fetching client documents:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    // Only ADMIN/MANAGER/EXECUTOR can upload documents for clients
    if (!(await can(session.user.id, session.user.role, PERMISSIONS.CLIENTS_EDIT))) {
      return NextResponse.json({ error: "ليس لديك صلاحية" }, { status: 403 });
    }

    const { id } = await params;
    const { title, fileUrl, fileType } = await request.json();

    if (!title || !fileUrl) {
      return NextResponse.json({ error: "العنوان ورابط الملف مطلوبان" }, { status: 400 });
    }

    const document = await prisma.clientDocument.create({
      data: {
        clientId: id,
        title,
        fileUrl,
        fileType: fileType || null,
        uploadedById: session.user.id,
      },
      include: {
        uploadedBy: { select: { id: true, name: true } },
      },
    });

    // Phase B — dual-write to record system. Best-effort, never throws.
    void mirrorClientDocumentCreate({
      id: document.id,
      clientId: document.clientId,
      title: document.title,
      fileUrl: document.fileUrl,
      uploadedById: document.uploadedById,
    });

    // Notify the client
    await prisma.notification.create({
      data: {
        userId: id,
        type: "TASK_UPDATE" as const,
        message: `تم إضافة وثيقة جديدة: ${title}`,
        link: "/dashboard/my-documents",
      },
    });

    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    console.error("Error creating client document:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

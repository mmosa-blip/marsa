import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { mirrorDocumentCreate } from "@/lib/record-dual-write";
import { recordItemToDocument } from "@/lib/record-shape-adapter";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "غير مسجل الدخول" }, { status: 401 });
    }
    if (session.user.role !== "CLIENT") {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const userId = session.user.id;

    // ─── Phase C — read from the new record system ───────────────────
    // Reads ProjectRecordItem rows tagged [DOC:...] uploaded by this
    // user, adapts to the legacy Document shape. Falls back to legacy
    // if no tagged rows are present.
    const recordItems = await prisma.projectRecordItem.findMany({
      where: {
        uploadedById: userId,
        scope: "COMPLIANCE",
        deletedAt: null,
        title: { contains: "[DOC:" },
      },
      orderBy: [{ expiryDate: "asc" }],
    });

    if (recordItems.length > 0) {
      const adapted = recordItems
        .map((it) => recordItemToDocument(it))
        .filter((x): x is NonNullable<typeof x> => x !== null);
      return NextResponse.json(adapted);
    }

    // Fallback path — legacy table only.
    logger.warn("my-documents: no record-system rows, falling back to legacy", { userId });
    const documents = await prisma.document.findMany({
      where: { ownerId: userId },
      include: {
        company: { select: { name: true } },
      },
      orderBy: { expiryDate: "asc" },
    });

    return NextResponse.json(documents);
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "غير مسجل الدخول" }, { status: 401 });
    }
    if (session.user.role !== "CLIENT") {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const userId = session.user.id;
    const body = await request.json();

    if (!body.title) {
      return NextResponse.json({ error: "عنوان المستند مطلوب" }, { status: 400 });
    }

    const document = await prisma.document.create({
      data: {
        title: body.title,
        type: body.type || "CUSTOM",
        documentNumber: body.documentNumber || null,
        issueDate: body.issueDate ? new Date(body.issueDate) : null,
        expiryDate: body.expiryDate ? new Date(body.expiryDate) : null,
        companyId: body.companyId || null,
        notes: body.notes || null,
        isLinkedToCompany: !!body.companyId,
        ownerId: userId,
      },
      include: {
        company: { select: { name: true } },
      },
    });

    // Phase B — dual-write to record system. Best-effort, never throws.
    // Anchored to the owner's most recent project; skipped if none.
    void mirrorDocumentCreate({
      id: document.id,
      title: document.title,
      fileUrl: document.fileUrl,
      ownerId: document.ownerId,
      expiryDate: document.expiryDate,
      reminderDays: document.reminderDays,
      status: document.status,
      notes: document.notes,
    });

    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

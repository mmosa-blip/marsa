import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { mirrorDocumentCreate } from "@/lib/record-dual-write";

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

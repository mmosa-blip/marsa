import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { canViewRecordItem } from "@/lib/record-visibility";
import { appendRecordAudit } from "@/lib/record-audit";

/**
 * Comments for a record item.
 *
 *   GET  — list (oldest first). Visible to anyone who can view the item.
 *   POST — { body }. Adds a comment. Author = current user. Anyone with
 *          view access can comment — gating finer than that belongs in
 *          a future review/permissions pass.
 */

async function loadItemForGuard(itemId: string) {
  return prisma.projectRecordItem.findUnique({
    where: { id: itemId },
    select: {
      id: true,
      visibility: true,
      isSharedWithClient: true,
      uploadedById: true,
      deletedAt: true,
      project: { select: { clientId: true, deletedAt: true } },
    },
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const item = await loadItemForGuard(id);
    if (!item || item.deletedAt) {
      return NextResponse.json({ error: "غير موجود" }, { status: 404 });
    }
    if (!item.project || item.project.deletedAt) {
      return NextResponse.json({ error: "المشروع غير موجود" }, { status: 404 });
    }
    if (
      !canViewRecordItem({
        role: session.user.role,
        userId: session.user.id,
        projectClientId: item.project.clientId,
        item: {
          visibility: item.visibility,
          isSharedWithClient: item.isSharedWithClient,
          uploadedById: item.uploadedById,
        },
      })
    ) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const comments = await prisma.recordItemComment.findMany({
      where: { recordItemId: id },
      orderBy: { createdAt: "asc" },
      include: { author: { select: { id: true, name: true } } },
    });

    return NextResponse.json(comments);
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("comments GET", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const item = await loadItemForGuard(id);
    if (!item || item.deletedAt) {
      return NextResponse.json({ error: "غير موجود" }, { status: 404 });
    }
    if (!item.project || item.project.deletedAt) {
      return NextResponse.json({ error: "المشروع غير موجود" }, { status: 404 });
    }
    if (
      !canViewRecordItem({
        role: session.user.role,
        userId: session.user.id,
        projectClientId: item.project.clientId,
        item: {
          visibility: item.visibility,
          isSharedWithClient: item.isSharedWithClient,
          uploadedById: item.uploadedById,
        },
      })
    ) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const body = await request.json();
    const text = String(body.body ?? "").trim();
    if (!text) {
      return NextResponse.json({ error: "النص مطلوب" }, { status: 400 });
    }

    const comment = await prisma.recordItemComment.create({
      data: {
        recordItemId: id,
        authorId: session.user.id,
        body: text,
      },
      include: { author: { select: { id: true, name: true } } },
    });

    await appendRecordAudit({
      recordItemId: id,
      action: "COMMENT_ADDED",
      actorId: session.user.id,
      after: { commentId: comment.id, length: text.length },
    });

    return NextResponse.json(comment, { status: 201 });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("comments POST", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

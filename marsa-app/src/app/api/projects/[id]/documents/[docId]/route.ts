import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import { requireAuth, requireRole } from "@/lib/api-auth";

// GET — single document
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    await requireAuth();
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }

  const { docId } = await params;
  const doc = await prisma.projectDocument.findUnique({
    where: { id: docId },
    include: {
      documentType: true,
      uploadedBy: { select: { id: true, name: true } },
      reviewedBy: { select: { id: true, name: true } },
      project: { select: { id: true, clientId: true, name: true } },
    },
  });
  if (!doc) return NextResponse.json({ error: "غير موجود" }, { status: 404 });
  return NextResponse.json(doc);
}

// PATCH — review actions (approve/reject/share with client)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const session = await requireAuth();

    const { docId } = await params;
    const body = await request.json();
    const { action, rejectionReason, isSharedWithClient } = body;

    const doc = await prisma.projectDocument.findUnique({
      where: { id: docId },
      include: {
        documentType: { select: { name: true } },
        project: { select: { clientId: true, name: true } },
      },
    });
    if (!doc) return NextResponse.json({ error: "غير موجود" }, { status: 404 });

    const data: Record<string, unknown> = {};

    if (action === "approve") {
      if (!["ADMIN", "MANAGER", "EXECUTOR"].includes(session.user.role)) {
        return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
      }
      data.status = "APPROVED";
      data.reviewedById = session.user.id;
      data.reviewedAt = new Date();
      if (doc.uploadedById) {
        createNotification({
          userId: doc.uploadedById,
          type: "TASK_UPDATE",
          message: `تم اعتماد المستند: ${doc.documentType?.name}`,
          link: `/dashboard/projects/${doc.projectId}/documents`,
        }).catch(() => {});
      }
    } else if (action === "reject") {
      if (!["ADMIN", "MANAGER", "EXECUTOR"].includes(session.user.role)) {
        return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
      }
      if (!rejectionReason?.trim()) {
        return NextResponse.json({ error: "سبب الرفض مطلوب" }, { status: 400 });
      }
      data.status = "REJECTED";
      data.rejectionReason = rejectionReason.trim();
      data.reviewedById = session.user.id;
      data.reviewedAt = new Date();
      const reasonSuffix = ` — السبب: ${rejectionReason.trim()}`;
      if (doc.uploadedById) {
        createNotification({
          userId: doc.uploadedById,
          type: "TASK_REJECTED",
          message: `تم رفض المستند: ${doc.documentType?.name} — يرجى إعادة الرفع${reasonSuffix}`,
          link: `/dashboard/projects/${doc.projectId}/documents`,
        }).catch(() => {});
      }
      // Also notify client if they didn't upload it themselves
      if (doc.project.clientId && doc.project.clientId !== doc.uploadedById) {
        createNotification({
          userId: doc.project.clientId,
          type: "TASK_REJECTED",
          message: `تم رفض مستند: ${doc.documentType?.name} — يرجى إعادة الرفع${reasonSuffix}`,
          link: `/dashboard/my-documents`,
        }).catch(() => {});
      }
    } else if (isSharedWithClient !== undefined) {
      if (!["ADMIN", "MANAGER"].includes(session.user.role)) {
        return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
      }
      data.isSharedWithClient = !!isSharedWithClient;
      if (isSharedWithClient) {
        createNotification({
          userId: doc.project.clientId,
          type: "NEW_MESSAGE",
          message: `تمت مشاركة مستند جديد معك: ${doc.documentType?.name}`,
          link: `/dashboard/my-documents`,
        }).catch(() => {});
      }
    } else {
      return NextResponse.json({ error: "إجراء غير صالح" }, { status: 400 });
    }

    const updated = await prisma.projectDocument.update({
      where: { id: docId },
      data,
    });
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

// DELETE
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    await requireRole(["ADMIN", "MANAGER"]);
    const { docId } = await params;
    await prisma.projectDocument.delete({ where: { id: docId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

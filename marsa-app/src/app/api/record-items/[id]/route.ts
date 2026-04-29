import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { canViewRecordItem } from "@/lib/record-visibility";
import { encryptSecret, maskSecret } from "@/lib/secrets";
import { appendRecordAudit } from "@/lib/record-audit";
import type { Prisma } from "@/generated/prisma/client";

const ALLOWED_VISIBILITY = [
  "ALL",
  "EXECUTORS_AND_ADMIN",
  "ADMIN_ONLY",
  "CLIENT_AND_ADMIN",
] as const;

const ALLOWED_STATUS = [
  "DRAFT",
  "PENDING_REVIEW",
  "APPROVED",
  "REJECTED",
  "MISSING",
  "EXPIRED",
  "ARCHIVED",
] as const;

// What the per-item endpoints expose for PlatformAccount. Decrypted
// password is intentionally NOT here — it gets its own reveal endpoint
// in Tier 7 with audit logging.
const PLATFORM_ACCOUNT_DETAIL_SHAPE = {
  id: true,
  platformName: true,
  platformUrl: true,
  username: true,
  twoFactorMethod: true,
  ownedById: true,
  ownedBy: { select: { id: true, name: true } },
  handedOverAt: true,
  lastViewedAt: true,
  lastViewedBy: { select: { id: true, name: true } },
  notes: true,
  createdAt: true,
  updatedAt: true,
} as const;

async function loadItemWithProject(itemId: string) {
  return prisma.projectRecordItem.findUnique({
    where: { id: itemId },
    include: {
      project: { select: { id: true, clientId: true, name: true, deletedAt: true } },
      documentType: {
        select: { id: true, name: true, kind: true, isPerPartner: true, fields: true },
      },
      partner: {
        select: { id: true, partnerNumber: true, name: true, role: true },
      },
      service: { select: { id: true, name: true } },
      uploadedBy: { select: { id: true, name: true } },
      reviewedBy: { select: { id: true, name: true } },
      sourceTemplateRequirement: {
        select: { id: true, label: true, isPerPartner: true },
      },
      platformAccount: { select: PLATFORM_ACCOUNT_DETAIL_SHAPE },
      platformLink: true,
      issue: {
        include: {
          reportedBy: { select: { id: true, name: true } },
          assignedTo: { select: { id: true, name: true } },
        },
      },
      comments: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, name: true } } },
      },
      auditEntries: {
        orderBy: { createdAt: "desc" },
        take: 100,
        include: { actor: { select: { id: true, name: true } } },
      },
      taskLinks: {
        include: {
          task: { select: { id: true, title: true, status: true } },
        },
      },
    },
  });
}

/**
 * GET /api/record-items/[id]
 *
 * Single item with all siblings, comments, audit trail, and linked tasks.
 * `encryptedPayload` is replaced with a masked stub — clients that need
 * the real value must hit a dedicated reveal endpoint (added in Tier 7).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const role = session.user.role;
    const userId = session.user.id;

    const item = await loadItemWithProject(id);
    if (!item || item.deletedAt) {
      return NextResponse.json({ error: "غير موجود" }, { status: 404 });
    }
    if (!item.project || item.project.deletedAt) {
      return NextResponse.json({ error: "المشروع غير موجود" }, { status: 404 });
    }
    if (
      !canViewRecordItem({
        role,
        userId,
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

    // Mask any sensitive payload before returning.
    const safe = {
      ...item,
      encryptedPayload: item.encryptedPayload
        ? maskSecret(item.encryptedPayload)
        : null,
    };

    return NextResponse.json(safe);
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("record-items GET", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

/**
 * PATCH /api/record-items/[id]
 *
 * Partial update. Accepted fields:
 *   title, description, status, visibility, isSharedWithClient,
 *   fileUrl, textData, sensitiveData (re-encrypted), expiryDate,
 *   reminderDays, partnerId, serviceId, documentTypeId,
 *   rejectionReason, action ("approve" | "reject").
 *
 * Authorisation:
 *   - ADMIN / MANAGER → any field.
 *   - EXECUTOR        → status changes (action=approve/reject) +
 *                       isSharedWithClient toggle + their own uploads.
 *   - Uploader        → can edit while status ∈ {DRAFT, PENDING_REVIEW,
 *                       MISSING}.
 *   - CLIENT (uploader) → can edit while status ∈ {DRAFT,
 *                       PENDING_REVIEW, MISSING} for their own items.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const role = session.user.role;
    const userId = session.user.id;

    const existing = await prisma.projectRecordItem.findUnique({
      where: { id },
      include: {
        project: { select: { id: true, clientId: true, deletedAt: true } },
      },
    });
    if (!existing || existing.deletedAt) {
      return NextResponse.json({ error: "غير موجود" }, { status: 404 });
    }
    if (!existing.project || existing.project.deletedAt) {
      return NextResponse.json({ error: "المشروع غير موجود" }, { status: 404 });
    }
    if (existing.isObsolete) {
      return NextResponse.json(
        { error: "لا يمكن تعديل عنصر مهمل" },
        { status: 400 }
      );
    }

    const isAdminOrManager = role === "ADMIN" || role === "MANAGER";
    const isExecutor = role === "EXECUTOR" || role === "EXTERNAL_PROVIDER";
    const isUploader = existing.uploadedById === userId;

    const body = await request.json();
    const action = body.action ? String(body.action) : null;

    const data: Prisma.ProjectRecordItemUncheckedUpdateInput = {};
    let auditAction = "UPDATED";

    // ── Review actions (executor + admin / manager) ─────────────────
    if (action === "approve") {
      if (!isAdminOrManager && !isExecutor) {
        return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
      }
      data.status = "APPROVED";
      data.reviewedById = userId;
      data.reviewedAt = new Date();
      data.rejectionReason = null;
      auditAction = "APPROVED";
    } else if (action === "reject") {
      if (!isAdminOrManager && !isExecutor) {
        return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
      }
      const reason = String(body.rejectionReason || "").trim();
      if (!reason) {
        return NextResponse.json(
          { error: "سبب الرفض مطلوب" },
          { status: 400 }
        );
      }
      data.status = "REJECTED";
      data.rejectionReason = reason;
      data.reviewedById = userId;
      data.reviewedAt = new Date();
      auditAction = "REJECTED";
    } else {
      // ── Generic field updates ─────────────────────────────────────
      const editableForOwner =
        isAdminOrManager ||
        (isUploader &&
          ["DRAFT", "PENDING_REVIEW", "MISSING"].includes(existing.status));

      if (typeof body.title === "string") {
        if (!editableForOwner)
          return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
        const v = body.title.trim();
        if (!v)
          return NextResponse.json({ error: "العنوان مطلوب" }, { status: 400 });
        data.title = v;
      }
      if ("description" in body) {
        if (!editableForOwner)
          return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
        data.description = body.description?.toString().trim() || null;
      }
      if (typeof body.status === "string") {
        if (!isAdminOrManager)
          return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
        if (!(ALLOWED_STATUS as readonly string[]).includes(body.status)) {
          return NextResponse.json({ error: "حالة غير صالحة" }, { status: 400 });
        }
        data.status = body.status;
      }
      if (typeof body.visibility === "string") {
        if (!isAdminOrManager)
          return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
        if (!(ALLOWED_VISIBILITY as readonly string[]).includes(body.visibility)) {
          return NextResponse.json(
            { error: "مستوى visibility غير صالح" },
            { status: 400 }
          );
        }
        data.visibility = body.visibility;
      }
      if (typeof body.isSharedWithClient === "boolean") {
        if (!isAdminOrManager)
          return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
        data.isSharedWithClient = body.isSharedWithClient;
        if (body.isSharedWithClient) auditAction = "SHARED_WITH_CLIENT";
      }
      if ("fileUrl" in body) {
        if (!editableForOwner)
          return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
        data.fileUrl = body.fileUrl ? String(body.fileUrl) : null;
        // A new file resets the workflow to PENDING_REVIEW unless the
        // caller explicitly set status above.
        if (data.status === undefined && existing.kind === "DOCUMENT") {
          data.status = "PENDING_REVIEW";
          data.reviewedById = null;
          data.reviewedAt = null;
        }
      }
      if ("textData" in body) {
        if (!editableForOwner)
          return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
        data.textData = body.textData ? String(body.textData) : null;
      }
      if ("sensitiveData" in body) {
        if (!editableForOwner)
          return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
        data.encryptedPayload = body.sensitiveData
          ? encryptSecret(String(body.sensitiveData))
          : null;
      }
      if ("expiryDate" in body) {
        if (!editableForOwner)
          return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
        data.expiryDate = body.expiryDate ? new Date(body.expiryDate) : null;
      }
      if ("reminderDays" in body) {
        if (!editableForOwner)
          return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
        data.reminderDays =
          typeof body.reminderDays === "number" ? body.reminderDays : null;
      }
      if ("partnerId" in body) {
        if (!isAdminOrManager)
          return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
        data.partnerId = body.partnerId || null;
      }
      if ("serviceId" in body) {
        if (!isAdminOrManager)
          return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
        data.serviceId = body.serviceId || null;
      }
      if ("documentTypeId" in body) {
        if (!isAdminOrManager)
          return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
        data.documentTypeId = body.documentTypeId || null;
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "لا يوجد تعديل" }, { status: 400 });
    }

    const updated = await prisma.projectRecordItem.update({
      where: { id },
      data,
    });

    await appendRecordAudit({
      recordItemId: id,
      action: auditAction,
      actorId: userId,
      before: {
        status: existing.status,
        visibility: existing.visibility,
        isSharedWithClient: existing.isSharedWithClient,
        title: existing.title,
      },
      after: {
        status: updated.status,
        visibility: updated.visibility,
        isSharedWithClient: updated.isSharedWithClient,
        title: updated.title,
      },
    });

    return NextResponse.json(updated);
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("record-items PATCH", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

/**
 * DELETE /api/record-items/[id]
 *
 * Soft delete (sets `deletedAt`). Allowed by:
 *   - ADMIN / MANAGER — always.
 *   - The original uploader, but only while the item is still in
 *     {DRAFT, PENDING_REVIEW, MISSING} (i.e. before approval).
 *
 * The full restore flow lives in Tier 8 (recycle bin).
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const role = session.user.role;
    const userId = session.user.id;

    const existing = await prisma.projectRecordItem.findUnique({
      where: { id },
      select: {
        id: true,
        uploadedById: true,
        status: true,
        deletedAt: true,
      },
    });
    if (!existing || existing.deletedAt) {
      return NextResponse.json({ error: "غير موجود" }, { status: 404 });
    }

    const isAdminOrManager = role === "ADMIN" || role === "MANAGER";
    const isUploaderEarly =
      existing.uploadedById === userId &&
      ["DRAFT", "PENDING_REVIEW", "MISSING"].includes(existing.status);

    if (!isAdminOrManager && !isUploaderEarly) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    await prisma.projectRecordItem.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await appendRecordAudit({
      recordItemId: id,
      action: "DELETED",
      actorId: userId,
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("record-items DELETE", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

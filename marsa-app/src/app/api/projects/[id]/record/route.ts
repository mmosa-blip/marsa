import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { parsePagination, paginationMeta } from "@/lib/pagination";
import { buildRecordVisibilityWhere } from "@/lib/record-visibility";
import { encryptSecret } from "@/lib/secrets";
import { appendRecordAudit } from "@/lib/record-audit";
import type { Prisma } from "@/generated/prisma/client";

const ALLOWED_KINDS = [
  "DOCUMENT",
  "PLATFORM_ACCOUNT",
  "SENSITIVE_DATA",
  "NOTE",
  "ISSUE",
  "PLATFORM_LINK",
] as const;

const ALLOWED_SCOPES = ["PROJECT", "COMPLIANCE", "CLIENT", "TASK"] as const;

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

// Sensitive sibling fields that the list endpoint must NEVER expose. A
// detail endpoint with its own audit hook owns credential reveal.
const PLATFORM_ACCOUNT_LIST_SHAPE = {
  platformName: true,
  platformUrl: true,
  username: true,
  twoFactorMethod: true,
  ownedById: true,
  handedOverAt: true,
  lastViewedAt: true,
  lastViewedById: true,
  notes: true,
  createdAt: true,
} as const;

/**
 * GET /api/projects/[id]/record
 *
 * Lists record items for a project, scoped to the viewer's role.
 *
 * Query params:
 *   q                 — substring search on title/description (case-insensitive).
 *   kind              — single RecordItemKind filter.
 *   scope             — single RecordItemScope filter.
 *   status            — single RecordItemStatus filter.
 *   partnerId         — filter by partner ("none" → null).
 *   serviceId         — filter by service ("none" → null).
 *   documentTypeId    — filter by DocType.
 *   includeObsolete   — "true" to include items orphaned by template edits.
 *   includeAllVersions — "true" to include superseded historical rows.
 *   page, take         — pagination (default take=50, max 200).
 *
 * Body: paginated `{ items, total, page, take, pages, hasMore }`.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id: projectId } = await params;
    const role = session.user.role;
    const userId = session.user.id;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, clientId: true, deletedAt: true },
    });
    if (!project || project.deletedAt) {
      return NextResponse.json({ error: "المشروع غير موجود" }, { status: 404 });
    }
    if (role === "CLIENT" && project.clientId !== userId) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const url = new URL(request.url);
    const sp = url.searchParams;
    const { take, skip, page } = parsePagination(url, 50, 200);

    const where: Prisma.ProjectRecordItemWhereInput = {
      projectId,
      deletedAt: null,
      ...buildRecordVisibilityWhere(role, userId),
    };
    if (sp.get("includeObsolete") !== "true") where.isObsolete = false;
    if (sp.get("includeAllVersions") !== "true") where.supersededById = null;

    const q = (sp.get("q") || "").trim();
    if (q) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
          ],
        },
      ];
    }

    const kind = sp.get("kind");
    if (kind && (ALLOWED_KINDS as readonly string[]).includes(kind)) {
      where.kind = kind as (typeof ALLOWED_KINDS)[number];
    }
    const scope = sp.get("scope");
    if (scope && (ALLOWED_SCOPES as readonly string[]).includes(scope)) {
      where.scope = scope as (typeof ALLOWED_SCOPES)[number];
    }
    const status = sp.get("status");
    if (status && (ALLOWED_STATUS as readonly string[]).includes(status)) {
      where.status = status as (typeof ALLOWED_STATUS)[number];
    }
    const partnerId = sp.get("partnerId");
    if (partnerId) where.partnerId = partnerId === "none" ? null : partnerId;
    const serviceId = sp.get("serviceId");
    if (serviceId) where.serviceId = serviceId === "none" ? null : serviceId;
    const documentTypeId = sp.get("documentTypeId");
    if (documentTypeId) where.documentTypeId = documentTypeId;

    const [items, total] = await Promise.all([
      prisma.projectRecordItem.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: {
          documentType: {
            select: { id: true, name: true, kind: true, isPerPartner: true },
          },
          partner: {
            select: { id: true, partnerNumber: true, name: true, role: true },
          },
          service: { select: { id: true, name: true } },
          uploadedBy: { select: { id: true, name: true } },
          reviewedBy: { select: { id: true, name: true } },
          platformAccount: { select: PLATFORM_ACCOUNT_LIST_SHAPE },
          platformLink: true,
          issue: {
            select: {
              severity: true,
              status: true,
              reportedById: true,
              assignedToId: true,
              acknowledgedAt: true,
              resolvedAt: true,
            },
          },
          _count: { select: { comments: true, taskLinks: true } },
        },
      }),
      prisma.projectRecordItem.count({ where }),
    ]);

    return NextResponse.json({
      items,
      ...paginationMeta(total, page, take),
    });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("record GET", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

/**
 * POST /api/projects/[id]/record
 *
 * Creates one record item. The body shape varies by `kind`:
 *
 *   { kind: "DOCUMENT", title, fileUrl, documentTypeId?, expiryDate?,
 *     reminderDays?, partnerId?, serviceId?, visibility?,
 *     isSharedWithClient?, uploadedOnBehalfOfClient?, scope? }
 *
 *   { kind: "NOTE", title, textData, ... }
 *
 *   { kind: "SENSITIVE_DATA", title, sensitiveData, ... }
 *
 *   { kind: "PLATFORM_LINK", title,
 *     platformLink: { platformName, url, openInTaskPage? }, ... }
 *
 *   { kind: "PLATFORM_ACCOUNT", title,
 *     platformAccount: { platformName, platformUrl?, username, password,
 *       twoFactorMethod?, twoFactorRecovery?, notes?, ownedById? }, ... }
 *
 *   { kind: "ISSUE", title, description?,
 *     issue: { severity?, assignedToId? }, ... }
 *
 * Sequential create + cleanup-on-failure (no transaction): the parent
 * row is created first, then the kind-specific sibling. If the sibling
 * fails, the parent is hard-deleted before the error is bubbled up.
 * This keeps the route compatible with the pgbouncer pooler in
 * transaction mode (see operations/assign for the long story).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id: projectId } = await params;
    const role = session.user.role;
    const userId = session.user.id;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, clientId: true, deletedAt: true },
    });
    if (!project || project.deletedAt) {
      return NextResponse.json({ error: "المشروع غير موجود" }, { status: 404 });
    }
    if (role === "CLIENT" && project.clientId !== userId) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const body = await request.json();
    const kind = String(body.kind ?? "");
    if (!(ALLOWED_KINDS as readonly string[]).includes(kind)) {
      return NextResponse.json({ error: "نوع غير صالح" }, { status: 400 });
    }
    const title = String(body.title ?? "").trim();
    if (!title) {
      return NextResponse.json({ error: "العنوان مطلوب" }, { status: 400 });
    }

    // Status default depends on kind. DOCUMENT lands as PENDING_REVIEW so
    // it surfaces in the reviewer queue; everything else starts as DRAFT
    // unless the producer overrides it.
    const status =
      body.status &&
      (ALLOWED_STATUS as readonly string[]).includes(String(body.status))
        ? String(body.status)
        : kind === "DOCUMENT"
        ? "PENDING_REVIEW"
        : "DRAFT";

    // Visibility default also depends on kind. Sensitive payloads default
    // to ADMIN_ONLY; everything else defaults to EXECUTORS_AND_ADMIN.
    const requestedVisibility = body.visibility
      ? String(body.visibility)
      : null;
    const visibility =
      requestedVisibility &&
      (ALLOWED_VISIBILITY as readonly string[]).includes(requestedVisibility)
        ? requestedVisibility
        : kind === "ISSUE" || kind === "SENSITIVE_DATA"
        ? "ADMIN_ONLY"
        : "EXECUTORS_AND_ADMIN";

    const scope =
      body.scope &&
      (ALLOWED_SCOPES as readonly string[]).includes(String(body.scope))
        ? String(body.scope)
        : "PROJECT";

    // Kind-specific payload validation pre-create. Failures here do not
    // create any rows.
    if (kind === "DOCUMENT") {
      if (!body.fileUrl) {
        return NextResponse.json({ error: "ملف مطلوب" }, { status: 400 });
      }
    } else if (kind === "NOTE") {
      if (!body.textData) {
        return NextResponse.json({ error: "نص الملاحظة مطلوب" }, { status: 400 });
      }
    } else if (kind === "SENSITIVE_DATA") {
      if (!body.sensitiveData) {
        return NextResponse.json(
          { error: "البيانات الحساسة مطلوبة" },
          { status: 400 }
        );
      }
    } else if (kind === "PLATFORM_ACCOUNT") {
      const acc = body.platformAccount;
      if (!acc?.platformName || !acc?.username || !acc?.password) {
        return NextResponse.json(
          { error: "platformName, username, password مطلوبة" },
          { status: 400 }
        );
      }
    } else if (kind === "PLATFORM_LINK") {
      const link = body.platformLink;
      if (!link?.platformName || !link?.url) {
        return NextResponse.json(
          { error: "platformName, url مطلوبة" },
          { status: 400 }
        );
      }
    }

    const data: Prisma.ProjectRecordItemUncheckedCreateInput = {
      kind: kind as (typeof ALLOWED_KINDS)[number],
      scope: scope as (typeof ALLOWED_SCOPES)[number],
      status: status as (typeof ALLOWED_STATUS)[number],
      title,
      description: body.description?.toString().trim() || null,
      projectId,
      serviceId: body.serviceId || null,
      partnerId: body.partnerId || null,
      documentTypeId: body.documentTypeId || null,
      uploadedById: userId,
      uploadedOnBehalfOfClient: !!body.uploadedOnBehalfOfClient,
      visibility: visibility as (typeof ALLOWED_VISIBILITY)[number],
      isSharedWithClient: !!body.isSharedWithClient,
      sourceTemplateRequirementId: body.sourceTemplateRequirementId || null,
      expiryDate: body.expiryDate ? new Date(body.expiryDate) : null,
      reminderDays:
        typeof body.reminderDays === "number" ? body.reminderDays : null,
      fileUrl: kind === "DOCUMENT" ? String(body.fileUrl) : null,
      textData: kind === "NOTE" ? String(body.textData) : null,
      encryptedPayload:
        kind === "SENSITIVE_DATA" ? encryptSecret(String(body.sensitiveData)) : null,
    };

    // Step 1 — parent row.
    const item = await prisma.projectRecordItem.create({ data });

    // Step 2 — kind-specific sibling. On any failure, the parent is
    // rolled back so the DB doesn't end up with an orphan record item.
    try {
      if (kind === "PLATFORM_ACCOUNT") {
        const acc = body.platformAccount;
        await prisma.platformAccount.create({
          data: {
            recordItemId: item.id,
            platformName: String(acc.platformName),
            platformUrl: acc.platformUrl ? String(acc.platformUrl) : null,
            username: String(acc.username),
            encryptedPassword: encryptSecret(String(acc.password)),
            twoFactorMethod: acc.twoFactorMethod
              ? String(acc.twoFactorMethod)
              : null,
            twoFactorRecoveryEncrypted: acc.twoFactorRecovery
              ? encryptSecret(String(acc.twoFactorRecovery))
              : null,
            notes: acc.notes ? String(acc.notes) : null,
            ownedById: acc.ownedById || null,
          },
        });
      } else if (kind === "PLATFORM_LINK") {
        const link = body.platformLink;
        await prisma.platformLink.create({
          data: {
            recordItemId: item.id,
            platformName: String(link.platformName),
            url: String(link.url),
            openInTaskPage: link.openInTaskPage !== false,
          },
        });
      } else if (kind === "ISSUE") {
        const issue = body.issue || {};
        const ALLOWED_SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
        const severity =
          issue.severity &&
          (ALLOWED_SEVERITIES as readonly string[]).includes(String(issue.severity))
            ? (String(issue.severity) as (typeof ALLOWED_SEVERITIES)[number])
            : "MEDIUM";
        await prisma.projectIssue.create({
          data: {
            recordItemId: item.id,
            severity,
            status: "OPEN",
            reportedById: userId,
            assignedToId: issue.assignedToId || null,
          },
        });
      }
    } catch (siblingErr) {
      await prisma.projectRecordItem
        .delete({ where: { id: item.id } })
        .catch(() => {});
      throw siblingErr;
    }

    await appendRecordAudit({
      recordItemId: item.id,
      action: "CREATED",
      actorId: userId,
      after: {
        kind,
        title,
        status,
        visibility,
        partnerId: data.partnerId,
        serviceId: data.serviceId,
      },
    });

    // Re-read with includes so the client gets a complete object back.
    const full = await prisma.projectRecordItem.findUnique({
      where: { id: item.id },
      include: {
        documentType: { select: { id: true, name: true, kind: true } },
        partner: {
          select: { id: true, partnerNumber: true, name: true, role: true },
        },
        service: { select: { id: true, name: true } },
        uploadedBy: { select: { id: true, name: true } },
        platformAccount: { select: PLATFORM_ACCOUNT_LIST_SHAPE },
        platformLink: true,
        issue: true,
      },
    });

    return NextResponse.json(full, { status: 201 });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("record POST", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

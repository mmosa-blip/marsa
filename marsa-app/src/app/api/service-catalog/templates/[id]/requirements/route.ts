import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { logger } from "@/lib/logger";

// ═══════════════════════════════════════════════════════════════════════
// /api/service-catalog/templates/[id]/requirements
// ═══════════════════════════════════════════════════════════════════════
// Admins manage the record-item requirements that get spawned into
// every project instantiated from a service template.
//
//   GET   — list ServiceTemplateRequirement rows for the template,
//           ordered by `order ASC`. Authenticated callers can list;
//           non-admins shouldn't reach this UI but reading the list
//           does not leak anything sensitive on its own.
//   POST  — { label, kind, documentTypeId?, description?, isRequired?,
//             isPerPartner?, order? } → create.
//
// ADMIN / MANAGER only on POST.

const ALLOWED_KINDS = [
  "DOCUMENT",
  "PLATFORM_ACCOUNT",
  "SENSITIVE_DATA",
  "NOTE",
  "PLATFORM_LINK",
  "ISSUE",
] as const;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: serviceTemplateId } = await params;

    const template = await prisma.serviceTemplate.findUnique({
      where: { id: serviceTemplateId },
      select: { id: true },
    });
    if (!template) {
      return NextResponse.json({ error: "قالب الخدمة غير موجود" }, { status: 404 });
    }

    const requirements = await prisma.serviceTemplateRequirement.findMany({
      where: { serviceTemplateId },
      include: {
        documentType: {
          select: { id: true, name: true, kind: true, isPerPartner: true },
        },
        taskTemplate: {
          select: { id: true, name: true, sortOrder: true },
        },
      },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    });

    return NextResponse.json(requirements);
  } catch (e) {
    if (e instanceof Response) return e;
    logger.error("service-template requirements GET", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["ADMIN", "MANAGER"]);
    const { id: serviceTemplateId } = await params;

    const template = await prisma.serviceTemplate.findUnique({
      where: { id: serviceTemplateId },
      select: { id: true },
    });
    if (!template) {
      return NextResponse.json({ error: "قالب الخدمة غير موجود" }, { status: 404 });
    }

    const body = await request.json();
    const label = String(body.label ?? "").trim();
    if (!label) {
      return NextResponse.json({ error: "العنوان مطلوب" }, { status: 400 });
    }

    const kind = (ALLOWED_KINDS as readonly string[]).includes(String(body.kind))
      ? (body.kind as (typeof ALLOWED_KINDS)[number])
      : "DOCUMENT";

    // For non-DOCUMENT kinds documentTypeId is meaningless — drop it
    // rather than raising a 400, keeps the form forgiving when the
    // admin flips kind back and forth.
    const documentTypeId =
      kind === "DOCUMENT" && body.documentTypeId
        ? String(body.documentTypeId)
        : null;

    // Validate that taskTemplateId, when provided, belongs to this template.
    const rawTaskTemplateId = body.taskTemplateId
      ? String(body.taskTemplateId)
      : null;
    if (rawTaskTemplateId) {
      const tt = await prisma.taskTemplate.findFirst({
        where: { id: rawTaskTemplateId, serviceTemplateId },
        select: { id: true },
      });
      if (!tt) {
        return NextResponse.json(
          { error: "المهمة المحددة لا تنتمي لهذا القالب" },
          { status: 400 }
        );
      }
    }

    const order =
      typeof body.order === "number" && Number.isFinite(body.order)
        ? Math.trunc(body.order)
        : await nextOrder(serviceTemplateId);

    const created = await prisma.serviceTemplateRequirement.create({
      data: {
        serviceTemplateId,
        kind,
        label,
        description: body.description?.toString().trim() || null,
        documentTypeId,
        taskTemplateId: rawTaskTemplateId,
        isRequired: body.isRequired !== false,
        isPerPartner: !!body.isPerPartner,
        order,
      },
      include: {
        documentType: {
          select: { id: true, name: true, kind: true, isPerPartner: true },
        },
        taskTemplate: {
          select: { id: true, name: true, sortOrder: true },
        },
      },
    });

    // TODO(Tier 5): live-sync this requirement into every active
    // project that uses this template (spawn missing record items).
    // For now, the spawn helper picks it up the next time a project
    // is instantiated from the template.

    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    if (e instanceof Response) return e;
    logger.error("service-template requirements POST", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

async function nextOrder(serviceTemplateId: string): Promise<number> {
  const last = await prisma.serviceTemplateRequirement.findFirst({
    where: { serviceTemplateId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  return (last?.order ?? -1) + 1;
}

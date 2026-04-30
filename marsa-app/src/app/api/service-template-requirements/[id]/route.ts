import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { logger } from "@/lib/logger";
import type { Prisma } from "@/generated/prisma/client";

// ═══════════════════════════════════════════════════════════════════════
// /api/service-template-requirements/[id]
// ═══════════════════════════════════════════════════════════════════════
// Per-row PATCH/DELETE for ServiceTemplateRequirement. ADMIN / MANAGER
// only. Live-sync into active projects is left as a TODO (Tier 5).

const ALLOWED_KINDS = [
  "DOCUMENT",
  "PLATFORM_ACCOUNT",
  "SENSITIVE_DATA",
  "NOTE",
  "PLATFORM_LINK",
  "ISSUE",
] as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["ADMIN", "MANAGER"]);
    const { id } = await params;

    const existing = await prisma.serviceTemplateRequirement.findUnique({
      where: { id },
    });
    if (!existing) {
      return NextResponse.json({ error: "غير موجود" }, { status: 404 });
    }

    const body = await request.json();
    const data: Prisma.ServiceTemplateRequirementUncheckedUpdateInput = {};

    if ("label" in body) {
      const v = String(body.label ?? "").trim();
      if (!v) return NextResponse.json({ error: "العنوان مطلوب" }, { status: 400 });
      data.label = v;
    }
    if ("description" in body) {
      data.description = body.description?.toString().trim() || null;
    }
    if ("kind" in body) {
      if (!(ALLOWED_KINDS as readonly string[]).includes(String(body.kind))) {
        return NextResponse.json({ error: "نوع غير صالح" }, { status: 400 });
      }
      data.kind = body.kind;
      // Flipping away from DOCUMENT clears the doc-type pointer so the
      // row stays consistent.
      if (body.kind !== "DOCUMENT") data.documentTypeId = null;
    }
    if ("documentTypeId" in body) {
      data.documentTypeId = body.documentTypeId
        ? String(body.documentTypeId)
        : null;
    }
    if ("isRequired" in body) data.isRequired = !!body.isRequired;
    if ("isPerPartner" in body) data.isPerPartner = !!body.isPerPartner;
    if ("order" in body && typeof body.order === "number") {
      data.order = Math.trunc(body.order);
    }
    if ("taskTemplateId" in body) {
      const rawId = body.taskTemplateId ? String(body.taskTemplateId) : null;
      if (rawId) {
        // Validate the task template belongs to the same service template.
        const tt = await prisma.taskTemplate.findFirst({
          where: { id: rawId, serviceTemplateId: existing.serviceTemplateId },
          select: { id: true },
        });
        if (!tt) {
          return NextResponse.json(
            { error: "المهمة المحددة لا تنتمي لنفس قالب الخدمة" },
            { status: 400 }
          );
        }
      }
      data.taskTemplateId = rawId;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "لا يوجد تعديل" }, { status: 400 });
    }

    const updated = await prisma.serviceTemplateRequirement.update({
      where: { id },
      data,
      include: {
        documentType: {
          select: { id: true, name: true, kind: true, isPerPartner: true },
        },
        taskTemplate: {
          select: { id: true, name: true, sortOrder: true },
        },
      },
    });

    // TODO(Tier 5): propagate this update to record items already
    // spawned from this requirement on active projects.

    return NextResponse.json(updated);
  } catch (e) {
    if (e instanceof Response) return e;
    logger.error("service-template-requirement PATCH", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["ADMIN", "MANAGER"]);
    const { id } = await params;

    const existing = await prisma.serviceTemplateRequirement.findUnique({
      where: { id },
    });
    if (!existing) {
      return NextResponse.json({ error: "غير موجود" }, { status: 404 });
    }

    await prisma.serviceTemplateRequirement.delete({ where: { id } });

    // TODO(Tier 5): mark already-spawned record items as obsolete on
    // every active project that used this requirement, instead of
    // leaving orphaned MISSING placeholders behind. The schema already
    // has `isObsolete` + `obsoletedAt` for this case.

    return NextResponse.json({ success: true });
  } catch (e) {
    if (e instanceof Response) return e;
    logger.error("service-template-requirement DELETE", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

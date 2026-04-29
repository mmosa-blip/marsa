import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/api-auth";
import type { Prisma } from "@/generated/prisma/client";

const ALLOWED_ROLES = ["PARTNER", "OWNER", "AUTHORIZED_SIGNATORY"] as const;

/**
 * Per-partner endpoints.
 *
 *   GET    — single partner with their record items (head-of-chain
 *            only) + counts. Visible to anyone with project access.
 *   PATCH  — update name / nationalId / passportNumber / nationality /
 *            ownershipPercentage / role. ADMIN / MANAGER only.
 *   DELETE — hard delete the partner. The schema sets
 *            `ProjectRecordItem.partnerId = NULL` on cascade, so any
 *            already-uploaded items survive but lose their partner tag.
 *            ADMIN / MANAGER only.
 */

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; partnerId: string }> }
) {
  try {
    const session = await requireAuth();
    const { id: projectId, partnerId } = await params;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, clientId: true, deletedAt: true },
    });
    if (!project || project.deletedAt) {
      return NextResponse.json({ error: "المشروع غير موجود" }, { status: 404 });
    }
    if (
      session.user.role === "CLIENT" &&
      project.clientId !== session.user.id
    ) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const partner = await prisma.projectPartner.findFirst({
      where: { id: partnerId, projectId },
      include: {
        recordItems: {
          where: { deletedAt: null, supersededById: null, isObsolete: false },
          orderBy: { createdAt: "desc" },
          include: {
            documentType: { select: { id: true, name: true, kind: true } },
          },
        },
        _count: { select: { recordItems: true, documents: true } },
      },
    });
    if (!partner) {
      return NextResponse.json({ error: "غير موجود" }, { status: 404 });
    }
    return NextResponse.json(partner);
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("partner GET", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; partnerId: string }> }
) {
  try {
    await requireRole(["ADMIN", "MANAGER"]);
    const { id: projectId, partnerId } = await params;

    const partner = await prisma.projectPartner.findFirst({
      where: { id: partnerId, projectId },
    });
    if (!partner) {
      return NextResponse.json({ error: "غير موجود" }, { status: 404 });
    }

    const body = await request.json();
    const data: Prisma.ProjectPartnerUncheckedUpdateInput = {};

    if ("name" in body) {
      data.name = body.name?.toString().trim() || null;
    }
    if ("nationalId" in body) {
      data.nationalId = body.nationalId?.toString().trim() || null;
    }
    if ("passportNumber" in body) {
      data.passportNumber = body.passportNumber?.toString().trim() || null;
    }
    if ("nationality" in body) {
      data.nationality = body.nationality?.toString().trim() || null;
    }
    if ("ownershipPercentage" in body) {
      data.ownershipPercentage =
        typeof body.ownershipPercentage === "number"
          ? body.ownershipPercentage
          : null;
    }
    if ("role" in body) {
      if (!(ALLOWED_ROLES as readonly string[]).includes(String(body.role))) {
        return NextResponse.json({ error: "دور غير صالح" }, { status: 400 });
      }
      data.role = body.role;
    }
    if ("order" in body && typeof body.order === "number") {
      data.order = body.order;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "لا يوجد تعديل" }, { status: 400 });
    }

    const updated = await prisma.projectPartner.update({
      where: { id: partnerId },
      data,
    });
    return NextResponse.json(updated);
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("partner PATCH", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; partnerId: string }> }
) {
  try {
    await requireRole(["ADMIN", "MANAGER"]);
    const { id: projectId, partnerId } = await params;

    const partner = await prisma.projectPartner.findFirst({
      where: { id: partnerId, projectId },
    });
    if (!partner) {
      return NextResponse.json({ error: "غير موجود" }, { status: 404 });
    }

    await prisma.projectPartner.delete({ where: { id: partnerId } });
    return NextResponse.json({ success: true });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("partner DELETE", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

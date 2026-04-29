import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/api-auth";

const ALLOWED_ROLES = ["PARTNER", "OWNER", "AUTHORIZED_SIGNATORY"] as const;

/**
 * GET /api/projects/[id]/partners
 *
 * List partners for a project, ordered by partnerNumber. Visible to
 * anyone with project access (admin/manager always; client only on
 * their own project; everyone else where the wider project access
 * check has already let them through).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const project = await prisma.project.findUnique({
      where: { id },
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

    const partners = await prisma.projectPartner.findMany({
      where: { projectId: id },
      orderBy: [{ partnerNumber: "asc" }, { createdAt: "asc" }],
      include: {
        _count: { select: { recordItems: true, documents: true } },
      },
    });

    return NextResponse.json(partners);
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("partners GET", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

/**
 * POST /api/projects/[id]/partners
 *
 * Three accepted body shapes:
 *
 *   { count: 3 }
 *     → Pre-allocate N numbered placeholder partners with no data.
 *       Used when the admin only knows "this project has 3 partners"
 *       at creation time. Each one gets the next free partnerNumber.
 *
 *   { name?, nationalId?, passportNumber?, nationality?,
 *     ownershipPercentage?, role? }
 *     → Add a single partner with whatever data is available.
 *
 *   { partners: [{...}, {...}] }
 *     → Bulk-create with explicit data.
 *
 * Restricted to ADMIN / MANAGER. The next partnerNumber is computed by
 * looking at the current max for the project — concurrent creates from
 * two admins on the same project would race, but the
 * @@unique([projectId, partnerNumber]) constraint guarantees the loser
 * gets a constraint error rather than a duplicate row.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["ADMIN", "MANAGER"]);
    const { id: projectId } = await params;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, deletedAt: true },
    });
    if (!project || project.deletedAt) {
      return NextResponse.json({ error: "المشروع غير موجود" }, { status: 404 });
    }

    const body = await request.json();

    const last = await prisma.projectPartner.findFirst({
      where: { projectId },
      orderBy: { partnerNumber: "desc" },
      select: { partnerNumber: true },
    });
    let nextNumber = (last?.partnerNumber ?? 0) + 1;

    // ── count: pre-allocate N empty placeholders ────────────────────
    if (typeof body.count === "number" && body.count > 0) {
      if (body.count > 50) {
        return NextResponse.json({ error: "العدد كبير جداً" }, { status: 400 });
      }
      const created = [];
      for (let i = 0; i < body.count; i++) {
        const p = await prisma.projectPartner.create({
          data: {
            projectId,
            partnerNumber: nextNumber,
            name: null,
            role: "PARTNER",
            order: nextNumber,
          },
        });
        nextNumber++;
        created.push(p);
      }
      return NextResponse.json(created, { status: 201 });
    }

    // ── partners: array of structured rows ──────────────────────────
    if (Array.isArray(body.partners)) {
      if (body.partners.length > 50) {
        return NextResponse.json({ error: "العدد كبير جداً" }, { status: 400 });
      }
      const created = [];
      for (const p of body.partners) {
        const role = (ALLOWED_ROLES as readonly string[]).includes(p?.role)
          ? p.role
          : "PARTNER";
        const row = await prisma.projectPartner.create({
          data: {
            projectId,
            partnerNumber: nextNumber,
            name: p.name?.toString().trim() || null,
            nationalId: p.nationalId?.toString().trim() || null,
            passportNumber: p.passportNumber?.toString().trim() || null,
            nationality: p.nationality?.toString().trim() || null,
            ownershipPercentage:
              typeof p.ownershipPercentage === "number"
                ? p.ownershipPercentage
                : null,
            role,
            order: nextNumber,
          },
        });
        nextNumber++;
        created.push(row);
      }
      return NextResponse.json(created, { status: 201 });
    }

    // ── single structured partner ───────────────────────────────────
    const role = (ALLOWED_ROLES as readonly string[]).includes(body?.role)
      ? body.role
      : "PARTNER";
    const partner = await prisma.projectPartner.create({
      data: {
        projectId,
        partnerNumber: nextNumber,
        name: body.name?.toString().trim() || null,
        nationalId: body.nationalId?.toString().trim() || null,
        passportNumber: body.passportNumber?.toString().trim() || null,
        nationality: body.nationality?.toString().trim() || null,
        ownershipPercentage:
          typeof body.ownershipPercentage === "number"
            ? body.ownershipPercentage
            : null,
        role,
        order: nextNumber,
      },
    });
    return NextResponse.json(partner, { status: 201 });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("partners POST", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

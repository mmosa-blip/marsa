import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { logger } from "@/lib/logger";

// GET /api/contracts/[id]/services
//
// Returns the ordered list of services on the contract's project so
// the payments setup wizard can offer "link payment to service X" as
// a milestone trigger. Includes whether the service has any tasks
// (without a first task there is nothing to link to).

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["ADMIN", "MANAGER", "FINANCE_MANAGER"]);
    const { id } = await params;

    const contract = await prisma.contract.findUnique({
      where: { id },
      select: {
        id: true,
        project: {
          select: {
            id: true,
            name: true,
            services: {
              where: { deletedAt: null },
              select: {
                id: true,
                name: true,
                serviceOrder: true,
                _count: { select: { tasks: true } },
              },
              orderBy: { serviceOrder: "asc" },
            },
          },
        },
        linkedProjects: {
          select: {
            id: true,
            name: true,
            services: {
              where: { deletedAt: null },
              select: {
                id: true,
                name: true,
                serviceOrder: true,
                _count: { select: { tasks: true } },
              },
              orderBy: { serviceOrder: "asc" },
            },
          },
          take: 1,
        },
      },
    });
    if (!contract) {
      return NextResponse.json({ error: "العقد غير موجود" }, { status: 404 });
    }

    const project = contract.project ?? contract.linkedProjects[0] ?? null;
    return NextResponse.json({
      project: project
        ? { id: project.id, name: project.name }
        : null,
      services: (project?.services ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        serviceOrder: s.serviceOrder,
        hasTasks: s._count.tasks > 0,
      })),
    });
  } catch (e) {
    if (e instanceof Response) return e;
    logger.error("contracts services GET", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

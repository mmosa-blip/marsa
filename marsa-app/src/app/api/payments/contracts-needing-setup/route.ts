import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { logger } from "@/lib/logger";

// GET /api/payments/contracts-needing-setup
//
// Lists every active contract that has zero installments — the worklist
// the bulk wizard renders. Returns enough metadata for the page to show
// project name, client, contract value, status, and signing date.

export async function GET() {
  try {
    await requireRole(["ADMIN", "MANAGER", "FINANCE_MANAGER"]);

    const rows = await prisma.contract.findMany({
      where: {
        installments: { none: {} },
        status: { not: "CANCELLED" },
      },
      select: {
        id: true,
        contractNumber: true,
        status: true,
        signedAt: true,
        startDate: true,
        contractValue: true,
        createdAt: true,
        client: { select: { id: true, name: true, phone: true } },
        // Reverse relation (Contract.projectId → Project)
        project: {
          select: {
            id: true,
            name: true,
            projectCode: true,
            status: true,
            totalPrice: true,
          },
        },
        // Forward relation (Project.contractId → Contract); some legacy
        // data only lives here.
        linkedProjects: {
          select: { id: true, name: true, totalPrice: true },
          orderBy: { totalPrice: "desc" },
          take: 1,
        },
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    });

    // Fallback chain for the displayed value:
    //   contract.contractValue → project.totalPrice (either side of
    //   the relation) → null. The UI uses null as the trigger for
    //   the manual-input flow.
    const items = rows.map((c) => {
      const fromLinked = c.linkedProjects[0]?.totalPrice ?? null;
      const fromProject = c.project?.totalPrice ?? null;
      const fallback =
        fromLinked && fromLinked > 0
          ? fromLinked
          : fromProject && fromProject > 0
            ? fromProject
            : null;
      const effectiveValue =
        c.contractValue && c.contractValue > 0 ? c.contractValue : fallback;
      const valueSource =
        c.contractValue && c.contractValue > 0
          ? "contract"
          : fallback
            ? "project"
            : "missing";
      return { ...c, effectiveValue, valueSource };
    });

    return NextResponse.json({ items });
  } catch (e) {
    if (e instanceof Response) return e;
    logger.error("contracts-needing-setup GET", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

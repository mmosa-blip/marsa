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
        project: {
          select: { id: true, name: true, projectCode: true, status: true },
        },
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ items: rows });
  } catch (e) {
    if (e instanceof Response) return e;
    logger.error("contracts-needing-setup GET", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

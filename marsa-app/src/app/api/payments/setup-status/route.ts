import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { logger } from "@/lib/logger";

// GET /api/payments/setup-status
//
// Returns three counts the /dashboard/payments banner needs to decide
// whether to nag the admin into the bulk wizard:
//   - contractsWithoutInstallments — contracts that have zero installment
//     rows. These are exactly the rows the wizard targets.
//   - contractsToSign              — contracts still in DRAFT that ALSO
//     have no installments (the wizard's natural starting point: define
//     the schedule before signing).
//   - eligibleContracts            — total signed/draft contracts in
//     play, used as the denominator for "X / Y need attention".

export async function GET() {
  try {
    await requireRole(["ADMIN", "MANAGER", "FINANCE_MANAGER"]);

    // Mirror the orphan filter on /api/payments/contracts-needing-setup
    // — counts here drive the banner that links to that endpoint, so
    // they must agree.
    const liveProjectClause = {
      OR: [
        { project: { is: { deletedAt: null } } },
        { linkedProjects: { some: { deletedAt: null } } },
      ],
    };

    const [withoutInstallments, draftWithoutInstallments, eligible] =
      await Promise.all([
        prisma.contract.count({
          where: {
            installments: { none: {} },
            status: { not: "CANCELLED" },
            ...liveProjectClause,
          },
        }),
        prisma.contract.count({
          where: {
            installments: { none: {} },
            status: "DRAFT",
            ...liveProjectClause,
          },
        }),
        prisma.contract.count({
          where: {
            status: { not: "CANCELLED" },
            ...liveProjectClause,
          },
        }),
      ]);

    return NextResponse.json({
      contractsWithoutInstallments: withoutInstallments,
      contractsToSign: draftWithoutInstallments,
      eligibleContracts: eligible,
    });
  } catch (e) {
    if (e instanceof Response) return e;
    logger.error("setup-status GET", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

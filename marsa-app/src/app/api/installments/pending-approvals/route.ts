import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";

// GET /api/installments/pending-approvals
// Returns two arrays:
//   partialRequests — installments where an executor asked for a
//                     partial/full payment confirmation that hasn't
//                     been approved yet.
//   graceRequests   — installments where an executor asked for a
//                     grace period that hasn't been approved yet.
export async function GET() {
  try {
    await requireRole(["ADMIN", "MANAGER"]);

    const sharedInclude = {
      contract: {
        select: {
          id: true,
          project: {
            select: {
              id: true,
              name: true,
              projectCode: true,
              client: { select: { id: true, name: true } },
            },
          },
        },
      },
      linkedTask: {
        select: {
          id: true,
          title: true,
          assignee: { select: { id: true, name: true } },
        },
      },
    } as const;

    const [partialRequests, graceRequests] = await Promise.all([
      prisma.contractPaymentInstallment.findMany({
        where: {
          partialPaymentRequest: { not: null },
          partialApprovedById: null,
        },
        include: sharedInclude,
        orderBy: { createdAt: "desc" },
      }),
      prisma.contractPaymentInstallment.findMany({
        where: {
          gracePeriodDays: { not: null },
          gracePeriodApproved: false,
        },
        include: sharedInclude,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return NextResponse.json({ partialRequests, graceRequests });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("pending-approvals error:", e);
    return NextResponse.json({ error: "فشل التحميل" }, { status: 500 });
  }
}

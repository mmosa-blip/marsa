import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";

// GET /api/installments/pending-approvals
// Returns three arrays:
//   partialRequests       — partial/full payment requests via the legacy
//                           partial-request flow that haven't been
//                           approved yet.
//   graceRequests         — grace-period requests not yet approved.
//   confirmationRequests  — receipts recorded via /record-payment that
//                           are still in PENDING_CONFIRMATION and need
//                           a finance approver to confirm or reject.
export async function GET() {
  try {
    await requireRole(["ADMIN", "MANAGER", "FINANCE_MANAGER"]);

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

    const [partialRequests, graceRequests, confirmationRequests] = await Promise.all([
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
      prisma.contractPaymentInstallment.findMany({
        where: { confirmationStatus: "PENDING_CONFIRMATION" },
        include: sharedInclude,
        orderBy: { recordedAt: "desc" },
      }),
    ]);

    // recordedBy is denormalized into a name lookup so the UI can show
    // who reported the receipt without an extra round-trip.
    const recorderIds = [
      ...new Set(
        confirmationRequests
          .map((r) => r.recordedById)
          .filter((id): id is string => !!id)
      ),
    ];
    const recorders = recorderIds.length
      ? await prisma.user.findMany({
          where: { id: { in: recorderIds } },
          select: { id: true, name: true },
        })
      : [];
    const recorderMap = Object.fromEntries(recorders.map((u) => [u.id, u.name]));
    const confirmationRequestsWithRecorder = confirmationRequests.map((r) => ({
      ...r,
      recordedByName: r.recordedById ? recorderMap[r.recordedById] ?? null : null,
    }));

    return NextResponse.json({
      partialRequests,
      graceRequests,
      confirmationRequests: confirmationRequestsWithRecorder,
    });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("pending-approvals error:", e);
    return NextResponse.json({ error: "فشل التحميل" }, { status: 500 });
  }
}

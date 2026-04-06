import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ═══════════════════════════════════════════════════
// GET /api/contracts/check-expiry
// Scheduled check — safe to call repeatedly on page loads
// - Finds contracts expiring within 30 days
// - Creates ONE notification per admin per day (deduplicated)
// - Flags contracts expiring in ≤15 days as critical
// ═══════════════════════════════════════════════════

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ ok: true, skipped: "no session" });

    const now = new Date();
    const in30Days = new Date();
    in30Days.setDate(in30Days.getDate() + 30);

    // Get all contracts with end dates expiring within 30 days
    const contracts = await prisma.contract.findMany({
      where: {
        endDate: { gte: now, lte: in30Days },
      },
      select: {
        id: true,
        contractNumber: true,
        endDate: true,
        client: { select: { id: true, name: true } },
      },
    });

    if (contracts.length === 0) {
      return NextResponse.json({ ok: true, checked: 0, notified: 0 });
    }

    // Get all admins
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN", isActive: true, deletedAt: null },
      select: { id: true },
    });

    if (admins.length === 0) {
      return NextResponse.json({ ok: true, checked: contracts.length, notified: 0, skipped: "no admins" });
    }

    // Dedupe: check which admins already got a notification today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    let notifiedCount = 0;
    let criticalCount = 0;

    for (const contract of contracts) {
      if (!contract.endDate) continue;

      const daysRemaining = Math.ceil(
        (new Date(contract.endDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      const isCritical = daysRemaining <= 15;
      if (isCritical) criticalCount++;

      const label = contract.contractNumber ? `عقد #${contract.contractNumber}` : "عقد";
      const message = isCritical
        ? `⚠️ حرج: ${label} للعميل ${contract.client?.name || "—"} ينتهي خلال ${daysRemaining} يوم`
        : `${label} للعميل ${contract.client?.name || "—"} ينتهي خلال ${daysRemaining} يوم`;

      for (const admin of admins) {
        // Check if admin already notified about this contract today
        const existing = await prisma.notification.findFirst({
          where: {
            userId: admin.id,
            type: "DOCUMENT_EXPIRING",
            createdAt: { gte: todayStart },
            link: `/dashboard/contracts?id=${contract.id}`,
          },
        });

        if (!existing) {
          await prisma.notification.create({
            data: {
              userId: admin.id,
              type: "DOCUMENT_EXPIRING",
              message,
              link: `/dashboard/contracts?id=${contract.id}`,
            },
          });
          notifiedCount++;
        }
      }
    }

    return NextResponse.json({
      ok: true,
      checked: contracts.length,
      critical: criticalCount,
      notified: notifiedCount,
      admins: admins.length,
    });
  } catch (error) {
    console.error("Contract expiry check error:", error);
    return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });
  }
}

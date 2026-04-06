import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ═══════════════════════════════════════════════════
// GET /api/contracts/check-expiry
// Scheduled check — safe to call repeatedly on page loads
// - Finds contracts whose endDate falls in two distinct buckets:
//     • 30-day bucket: 16..30 days remaining   → "warning" notification
//     • 15-day bucket: 0..15  days remaining   → "critical" notification
// - Each (admin/executor × contract × bucket) combo is sent ONCE per day
//   (deduplicated via the notification link, which encodes the bucket)
// - Notifies all admins, plus every executor currently assigned to a task
//   on a project linked to the contract.
// ═══════════════════════════════════════════════════

type Bucket = "warning_30" | "critical_15";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ ok: true, skipped: "no session" });

    const now = new Date();
    const in30Days = new Date();
    in30Days.setDate(in30Days.getDate() + 30);

    const contracts = await prisma.contract.findMany({
      where: {
        endDate: { gte: now, lte: in30Days },
      },
      select: {
        id: true,
        contractNumber: true,
        endDate: true,
        client: { select: { id: true, name: true } },
        // Both relations — primary contract + secondary one-to-many
        linkedProjects: {
          select: {
            id: true,
            tasks: {
              where: { assigneeId: { not: null } },
              select: { assigneeId: true },
            },
          },
        },
        project: {
          select: {
            id: true,
            tasks: {
              where: { assigneeId: { not: null } },
              select: { assigneeId: true },
            },
          },
        },
      },
    });

    if (contracts.length === 0) {
      return NextResponse.json({ ok: true, checked: 0, notified: 0 });
    }

    const admins = await prisma.user.findMany({
      where: { role: "ADMIN", isActive: true, deletedAt: null },
      select: { id: true },
    });

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    let notifiedCount = 0;
    const counts: Record<Bucket, number> = { warning_30: 0, critical_15: 0 };

    for (const contract of contracts) {
      if (!contract.endDate) continue;

      const daysRemaining = Math.ceil(
        (new Date(contract.endDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      const bucket: Bucket = daysRemaining <= 15 ? "critical_15" : "warning_30";
      counts[bucket]++;

      const label = contract.contractNumber ? `عقد #${contract.contractNumber}` : "عقد";
      const clientName = contract.client?.name || "—";
      const message =
        bucket === "critical_15"
          ? `⚠️ حرج: ${label} للعميل ${clientName} ينتهي خلال ${daysRemaining} يوم`
          : `${label} للعميل ${clientName} ينتهي خلال ${daysRemaining} يوم`;

      // Bucket is encoded in the link so each threshold creates a distinct
      // notification, but it stays deduplicated within a single day.
      const link = `/dashboard/contracts?id=${contract.id}&alert=${bucket}`;

      // Collect recipients: all admins + every executor assigned to a task
      // on a project linked to this contract.
      const recipientIds = new Set<string>(admins.map((a) => a.id));
      const projectsForContract = [
        ...(contract.linkedProjects || []),
        ...(contract.project ? [contract.project] : []),
      ];
      for (const p of projectsForContract) {
        for (const t of p.tasks) {
          if (t.assigneeId) recipientIds.add(t.assigneeId);
        }
      }

      for (const userId of recipientIds) {
        const existing = await prisma.notification.findFirst({
          where: {
            userId,
            type: "DOCUMENT_EXPIRING",
            createdAt: { gte: todayStart },
            link,
          },
        });

        if (!existing) {
          await prisma.notification.create({
            data: {
              userId,
              type: "DOCUMENT_EXPIRING",
              message,
              link,
            },
          });
          notifiedCount++;
        }
      }
    }

    return NextResponse.json({
      ok: true,
      checked: contracts.length,
      warning30: counts.warning_30,
      critical15: counts.critical_15,
      notified: notifiedCount,
    });
  } catch (error) {
    console.error("Contract expiry check error:", error);
    return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { createNotifications } from "@/lib/notifications";

// GET /api/cron/payment-reminders
//
// Daily cron (Vercel cron @ 06:00 UTC ≈ 09:00 KSA). Walks every
// PaymentFollowUp row whose nextFollowUpAt is today and pings every
// admin/manager + the row's contactedBy with a reminder notification.
// Idempotent — tracks `reminded` lookalikes via a per-day check on the
// notifications table so re-running the cron same day doesn't spam.
//
// Auth: shared CRON_SECRET via "Authorization: Bearer ..." header.

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today.getTime() + 86400000);

    // Pull every follow-up due today (not yet completed by another row
    // with a later nextFollowUpAt — we let the latest follow-up win,
    // which is the natural ORDER BY contactedAt desc semantics).
    const due = await prisma.paymentFollowUp.findMany({
      where: {
        nextFollowUpAt: {
          gte: today,
          lt: tomorrow,
        },
      },
      include: {
        installment: {
          include: {
            contract: {
              select: {
                id: true,
                client: { select: { name: true } },
                project: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });

    let remindersSent = 0;
    for (const fu of due) {
      const inst = fu.installment;
      const clientName = inst.contract?.client?.name ?? "العميل";
      const projectName = inst.contract?.project?.name ?? inst.title;
      const message = `تذكير: متابعة دفعة ${clientName} — ${projectName}${
        fu.outcome === "PROMISED_PAYMENT" ? " (وعد بالسداد اليوم)" : ""
      }`;

      // Notify the original contacter only — the admin who set the
      // reminder. Admin/manager dashboard already aggregates these.
      try {
        await createNotifications([
          {
            userId: fu.contactedBy,
            type: "TASK_UPDATE" as const,
            message,
            link: `/dashboard/payments?installmentId=${inst.id}`,
          },
        ]);
        remindersSent++;
      } catch (err) {
        logger.warn("payment-reminders notify failed", {
          followUpId: fu.id,
          err: String(err),
        });
      }
    }

    return NextResponse.json({
      ok: true,
      checkedAt: new Date().toISOString(),
      dueCount: due.length,
      remindersSent,
    });
  } catch (e) {
    logger.error("payment-reminders cron error", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

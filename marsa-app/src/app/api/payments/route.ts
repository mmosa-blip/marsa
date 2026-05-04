import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { logger } from "@/lib/logger";
import { parsePagination, paginationMeta } from "@/lib/pagination";
import type { Prisma } from "@/generated/prisma/client";

// ═══════════════════════════════════════════════════════════════════════
// GET /api/payments
// ═══════════════════════════════════════════════════════════════════════
// Unified collections view of every ContractPaymentInstallment in the
// system, filtered by status / search / date range / executor / client.
// Returns both the rows and the dashboard summary counters in one
// response so the page header can render without a second round-trip.
//
// Auth: ADMIN / MANAGER / FINANCE_MANAGER / TREASURY_MANAGER.

export async function GET(request: NextRequest) {
  try {
    await requireRole(["ADMIN", "MANAGER", "FINANCE_MANAGER", "TREASURY_MANAGER"]);

    const url = new URL(request.url);
    const sp = url.searchParams;
    const { take, skip, page } = parsePagination(url, 50, 200);

    const status = sp.get("status"); // overdue | week | month | paid | upcoming | all
    const search = (sp.get("search") || "").trim();
    const clientId = sp.get("clientId");
    const executorId = sp.get("executorId");

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAhead = new Date(today.getTime() + 7 * 86400000);
    const monthAhead = new Date(today.getTime() + 30 * 86400000);

    const where: Prisma.ContractPaymentInstallmentWhereInput = {};

    if (status === "paid") {
      where.paymentStatus = "PAID";
    } else if (status === "overdue") {
      // Unpaid + due date passed (we treat the linked task's project as
      // the deadline source via dueAfterDays + contract.signedAt).
      where.paymentStatus = { not: "PAID" };
    } else if (status === "week") {
      where.paymentStatus = { not: "PAID" };
    } else if (status === "month") {
      where.paymentStatus = { not: "PAID" };
    }

    if (search) {
      // Search both project relations — Contract.project (reverse) is
      // empty for legacy template-driven contracts, where the project
      // only lives on Contract.linkedProjects (forward).
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { contract: { client: { name: { contains: search, mode: "insensitive" } } } },
        { contract: { client: { phone: { contains: search } } } },
        { contract: { project: { name: { contains: search, mode: "insensitive" } } } },
        { contract: { project: { projectCode: { contains: search } } } },
        { contract: { linkedProjects: { some: { name: { contains: search, mode: "insensitive" } } } } },
        { contract: { linkedProjects: { some: { projectCode: { contains: search } } } } },
      ];
    }
    if (clientId) where.contract = { ...(where.contract as object || {}), clientId };
    if (executorId) {
      where.linkedTask = { ...(where.linkedTask as object || {}), assigneeId: executorId };
    }

    const [items, total] = await Promise.all([
      prisma.contractPaymentInstallment.findMany({
        where,
        skip,
        take,
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        include: {
          contract: {
            select: {
              id: true,
              contractNumber: true,
              signedAt: true,
              client: { select: { id: true, name: true, phone: true } },
              project: {
                select: { id: true, name: true, projectCode: true, status: true },
              },
              // Forward relation fallback — used when Contract.projectId
              // is null (template-driven contracts before Fix C).
              linkedProjects: {
                select: { id: true, name: true, projectCode: true, status: true },
                take: 1,
              },
            },
          },
          linkedTask: {
            select: {
              id: true,
              title: true,
              status: true,
              assignee: { select: { id: true, name: true } },
              service: { select: { id: true, name: true, serviceOrder: true } },
              timeSummary: { select: { completedAt: true } },
            },
          },
          followUps: {
            select: {
              id: true,
              outcome: true,
              contactedAt: true,
              promisedDate: true,
              promisedAmount: true,
              notes: true,
              contactedByUser: { select: { id: true, name: true } },
            },
            orderBy: { contactedAt: "desc" },
            take: 5,
          },
        },
      }),
      prisma.contractPaymentInstallment.count({ where }),
    ]);

    // Compute "due date" per installment. Three rules in priority order:
    //
    //   1. MILESTONE-LINKED, task DONE, AND we have a real completion
    //      timestamp (taskTimeSummary.completedAt only — task.updatedAt
    //      is unreliable because it bumps for unrelated edits).
    //        dueDate = completedAt + 7 days
    //
    //   2. MILESTONE-LINKED, task not DONE OR we lack a real completion
    //      timestamp.
    //        dueDate = null (treat as WAITING_ON_TASK rather than fake
    //        a date and risk false "overdue" alarms).
    //
    //   3. NOT LINKED (upfront / legacy time-based)
    //        baseline = contract.signedAt OR installment.createdAt
    //        offset   = installment.dueAfterDays OR 30
    const GRACE_DAYS = 7;
    const enriched = items.map((it) => {
      const linkedTask = it.linkedTask;
      const isMilestone = !!linkedTask;
      const taskDone = linkedTask?.status === "DONE";
      // Strict — only the recorded completion timestamp counts. We
      // deliberately do NOT fall back to task.updatedAt here.
      const completedAt = linkedTask?.timeSummary?.completedAt ?? null;

      let dueDate: Date | null;
      let milestoneState: "DUE_NOW" | "WAITING_ON_TASK" | "TIME_BASED" = "TIME_BASED";

      if (isMilestone && taskDone && completedAt) {
        dueDate = new Date(new Date(completedAt).getTime() + GRACE_DAYS * 86400000);
        milestoneState = "DUE_NOW";
      } else if (isMilestone) {
        // Either the task is still open, or it is DONE but we don't
        // have a trustworthy completion time — keep the row off the
        // overdue clock.
        dueDate = null;
        milestoneState = "WAITING_ON_TASK";
      } else {
        const baseline = it.contract?.signedAt ?? it.createdAt;
        const offsetDays = it.dueAfterDays ?? 30;
        dueDate = new Date(new Date(baseline).getTime() + offsetDays * 86400000);
        milestoneState = "TIME_BASED";
      }

      const remaining = Math.max(
        0,
        it.amount -
          it.paidAmount -
          (it.waiverAmount ? Number(it.waiverAmount) : 0)
      );
      const isPaid = it.paymentStatus === "PAID" || remaining === 0;
      const daysOverdue =
        dueDate && !isPaid && dueDate.getTime() < today.getTime()
          ? Math.floor((today.getTime() - dueDate.getTime()) / 86400000)
          : 0;

      // Pick whichever side of the project relation is populated.
      const effectiveProject =
        it.contract?.project ?? it.contract?.linkedProjects?.[0] ?? null;

      return {
        ...it,
        contract: it.contract
          ? {
              ...it.contract,
              project: effectiveProject,
              // Hide the implementation detail from the client.
              linkedProjects: undefined,
            }
          : it.contract,
        dueDate,
        daysOverdue,
        remainingAmount: remaining,
        isPaid,
        milestoneState,
        taskCompletedAt: completedAt,
      };
    });

    // Apply secondary status filter (client-side bucket since due date
    // is derived).
    const filtered =
      status === "overdue"
        ? enriched.filter((it) => it.daysOverdue > 0 && !it.isPaid)
        : status === "week"
          ? enriched.filter(
              (it) =>
                !it.isPaid &&
                it.dueDate &&
                it.dueDate.getTime() >= today.getTime() &&
                it.dueDate.getTime() <= weekAhead.getTime()
            )
          : status === "month"
            ? enriched.filter(
                (it) =>
                  !it.isPaid &&
                  it.dueDate &&
                  it.dueDate.getTime() >= today.getTime() &&
                  it.dueDate.getTime() <= monthAhead.getTime()
              )
            : enriched;

    // Dashboard summary — global counters across the whole table, NOT
    // the page slice. Cheap because it's two count + one aggregate query.
    const [allUnpaid, paidAgg] = await Promise.all([
      prisma.contractPaymentInstallment.findMany({
        where: { paymentStatus: { not: "PAID" } },
        select: {
          amount: true,
          paidAmount: true,
          waiverAmount: true,
          dueAfterDays: true,
          createdAt: true,
          linkedTask: {
            select: {
              status: true,
              timeSummary: { select: { completedAt: true } },
            },
          },
          contract: {
            select: { clientId: true, signedAt: true },
          },
        },
      }),
      prisma.contractPaymentInstallment.aggregate({
        _sum: { paidAmount: true },
        where: { paymentStatus: "PAID" },
      }),
    ]);

    let totalDue = 0;
    let totalOverdue = 0;
    let overdueDaysSum = 0;
    let overdueCount = 0;
    const overdueClients = new Set<string>();
    const GRACE = 7;

    for (const r of allUnpaid) {
      const remain = Math.max(
        0,
        r.amount -
          r.paidAmount -
          (r.waiverAmount ? Number(r.waiverAmount) : 0)
      );
      totalDue += remain;

      // Mirror the row-level dueDate logic so summary and table stay
      // in lockstep:
      //   - milestone-linked + task DONE → due = completedAt + 7d
      //   - milestone-linked + task open → not on the overdue clock
      //   - unlinked                     → signedAt/createdAt + dueAfterDays/30
      const linked = r.linkedTask;
      let due: Date | null = null;
      if (linked) {
        // Same strict rule as the row enrichment — only the time
        // summary's completedAt counts, never task.updatedAt.
        const completed = linked.timeSummary?.completedAt ?? null;
        if (linked.status === "DONE" && completed) {
          due = new Date(new Date(completed).getTime() + GRACE * 86400000);
        } else {
          due = null;
        }
      } else {
        const baseline = r.contract?.signedAt ?? r.createdAt;
        const offsetDays = r.dueAfterDays ?? 30;
        due = new Date(new Date(baseline).getTime() + offsetDays * 86400000);
      }

      if (due && due.getTime() < today.getTime() && remain > 0) {
        totalOverdue += remain;
        overdueDaysSum += (today.getTime() - due.getTime()) / 86400000;
        overdueCount++;
        if (r.contract?.clientId) overdueClients.add(r.contract.clientId);
      }
    }

    const summary = {
      totalDue: Math.round(totalDue),
      totalOverdue: Math.round(totalOverdue),
      overdueClientsCount: overdueClients.size,
      avgOverdueDays:
        overdueCount > 0 ? Math.round(overdueDaysSum / overdueCount) : 0,
      // Extras the UI uses
      totalCollected: Math.round(paidAgg._sum.paidAmount ?? 0),
      overdueInstallmentsCount: overdueCount,
    };

    return NextResponse.json({
      items: filtered,
      summary,
      ...paginationMeta(total, page, take),
    });
  } catch (e) {
    if (e instanceof Response) return e;
    logger.error("payments GET", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

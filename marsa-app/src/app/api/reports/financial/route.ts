import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (
      !session ||
      !["ADMIN", "MANAGER", "FINANCE_MANAGER"].includes(session.user.role)
    ) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    const now = new Date();
    const from = fromParam
      ? new Date(fromParam)
      : new Date(now.getFullYear(), now.getMonth() - 6, 1);
    const to = toParam ? new Date(toParam) : now;

    // Fetch paid invoices in date range
    const paidInvoices = await prisma.invoice.findMany({
      where: {
        status: "PAID",
        issueDate: { gte: from, lte: to },
      },
      include: {
        project: { select: { id: true, name: true, projectCode: true } },
        client: { select: { id: true, name: true } },
      },
    });

    // Monthly revenue grouping
    const revenueMap: Record<string, number> = {};
    for (const inv of paidInvoices) {
      const d = new Date(inv.issueDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      revenueMap[key] = (revenueMap[key] || 0) + inv.totalAmount;
    }
    const revenue = Object.entries(revenueMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, total]) => ({ month, total }));

    // Fetch paid payment requests in date range
    const paidPayments = await prisma.paymentRequest.findMany({
      where: {
        status: "PAID",
        paidAt: { gte: from, lte: to },
      },
      include: {
        provider: { select: { id: true, name: true } },
        taskCost: {
          include: {
            task: {
              select: {
                projectId: true,
                project: { select: { id: true, name: true, projectCode: true } },
              },
            },
          },
        },
      },
    });

    // Expenses by provider (for pie chart)
    const expensesByProvider: Record<string, { name: string; total: number }> = {};
    for (const pr of paidPayments) {
      const pName = pr.provider.name;
      if (!expensesByProvider[pName]) {
        expensesByProvider[pName] = { name: pName, total: 0 };
      }
      expensesByProvider[pName].total += pr.amount;
    }
    const expenses = Object.values(expensesByProvider);

    // Profitability per project
    const projectRevenue: Record<string, { name: string; projectCode: string | null; revenue: number; expenses: number }> = {};

    for (const inv of paidInvoices) {
      if (inv.projectId && inv.project) {
        if (!projectRevenue[inv.projectId]) {
          projectRevenue[inv.projectId] = {
            name: inv.project.name,
            projectCode: inv.project.projectCode ?? null,
            revenue: 0,
            expenses: 0,
          };
        }
        projectRevenue[inv.projectId].revenue += inv.totalAmount;
      }
    }

    for (const pr of paidPayments) {
      const projId = pr.taskCost?.task?.projectId;
      const projName = pr.taskCost?.task?.project?.name;
      const projCode = pr.taskCost?.task?.project?.projectCode ?? null;
      if (projId && projName) {
        if (!projectRevenue[projId]) {
          projectRevenue[projId] = { name: projName, projectCode: projCode, revenue: 0, expenses: 0 };
        }
        projectRevenue[projId].expenses += pr.amount;
      }
    }

    const profitability = Object.entries(projectRevenue).map(
      ([id, data]) => ({
        id,
        name: data.name,
        projectCode: data.projectCode,
        revenue: data.revenue,
        expenses: data.expenses,
        profit: data.revenue - data.expenses,
        margin:
          data.revenue > 0
            ? Math.round(((data.revenue - data.expenses) / data.revenue) * 100)
            : 0,
      })
    );

    // Receivables - overdue invoices with aging
    const overdueInvoices = await prisma.invoice.findMany({
      where: {
        status: { in: ["SENT", "OVERDUE"] },
        dueDate: { lt: now },
      },
      include: {
        client: { select: { name: true } },
      },
    });

    const receivables = overdueInvoices.map((inv) => {
      const daysOverdue = Math.floor(
        (now.getTime() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24)
      );
      let agingBucket: string;
      if (daysOverdue <= 30) agingBucket = "0-30";
      else if (daysOverdue <= 60) agingBucket = "31-60";
      else if (daysOverdue <= 90) agingBucket = "61-90";
      else agingBucket = "90+";

      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        clientName: inv.client?.name || "—",
        totalAmount: inv.totalAmount,
        daysOverdue,
        agingBucket,
      };
    });

    // Summary
    const totalRevenue = paidInvoices.reduce((s, i) => s + i.totalAmount, 0);
    const totalExpenses = paidPayments.reduce((s, p) => s + p.amount, 0);
    const overdueAmount = overdueInvoices.reduce(
      (s, i) => s + i.totalAmount,
      0
    );

    return NextResponse.json({
      revenue,
      expenses,
      profitability,
      receivables,
      summary: {
        totalRevenue,
        totalExpenses,
        netProfit: totalRevenue - totalExpenses,
        overdueAmount,
      },
    });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

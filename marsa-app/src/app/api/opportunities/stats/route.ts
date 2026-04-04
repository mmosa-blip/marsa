import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const opportunities = await prisma.opportunity.findMany({
      select: { stage: true, value: true },
    });

    const stages = ["CONTACT", "INTEREST", "NEGOTIATION", "CLOSED_WON", "CLOSED_LOST"] as const;

    const byStage = stages.map((stage) => {
      const items = opportunities.filter((o) => o.stage === stage);
      return {
        stage,
        count: items.length,
        totalValue: items.reduce((sum, o) => sum + (o.value || 0), 0),
      };
    });

    const total = opportunities.length;
    const won = opportunities.filter((o) => o.stage === "CLOSED_WON").length;
    const lost = opportunities.filter((o) => o.stage === "CLOSED_LOST").length;
    const closed = won + lost;
    const conversionRate = closed > 0 ? Math.round((won / closed) * 100) : 0;
    const totalValue = opportunities.reduce((sum, o) => sum + (o.value || 0), 0);
    const wonValue = opportunities.filter((o) => o.stage === "CLOSED_WON").reduce((sum, o) => sum + (o.value || 0), 0);

    return NextResponse.json({
      total,
      won,
      lost,
      conversionRate,
      totalValue,
      wonValue,
      byStage,
    });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

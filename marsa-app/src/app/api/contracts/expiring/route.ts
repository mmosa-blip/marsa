import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET — list contracts expiring within next X days (default 30)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role === "CLIENT") {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") || "30");
    const departmentId = searchParams.get("departmentId");

    const now = new Date();
    const limit = new Date();
    limit.setDate(limit.getDate() + days);

    const where: Record<string, unknown> = {
      endDate: { gte: now, lte: limit },
    };

    // Filter by department via linked project
    if (departmentId) {
      where.linkedProjects = { some: { departmentId } };
    }

    const contracts = await prisma.contract.findMany({
      where,
      include: {
        client: { select: { id: true, name: true, phone: true } },
        linkedProjects: {
          select: {
            id: true,
            name: true,
            department: { select: { id: true, name: true, color: true } },
          },
        },
      },
      orderBy: { endDate: "asc" },
    });

    // Enrich with days remaining and urgency
    const enriched = contracts.map((c) => {
      const daysRemaining = c.endDate
        ? Math.ceil((new Date(c.endDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      let urgency: "critical" | "warning" | "normal" = "normal";
      let color = "#C9A84C";
      if (daysRemaining !== null) {
        if (daysRemaining <= 15) {
          urgency = "critical";
          color = "#DC2626";
        } else if (daysRemaining <= 30) {
          urgency = "warning";
          color = "#EA580C";
        }
      }

      return { ...c, daysRemaining, urgency, urgencyColor: color };
    });

    // Also fetch already expired contracts
    const expired = await prisma.contract.findMany({
      where: {
        endDate: { lt: now },
        ...(departmentId ? { linkedProjects: { some: { departmentId } } } : {}),
      },
      include: {
        client: { select: { id: true, name: true } },
        linkedProjects: {
          select: {
            id: true,
            name: true,
            department: { select: { id: true, name: true, color: true } },
          },
        },
      },
      orderBy: { endDate: "desc" },
      take: 20,
    });

    return NextResponse.json({
      expiring: enriched,
      expired,
      counts: {
        critical: enriched.filter((c) => c.urgency === "critical").length,
        warning: enriched.filter((c) => c.urgency === "warning").length,
        expired: expired.length,
      },
    });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

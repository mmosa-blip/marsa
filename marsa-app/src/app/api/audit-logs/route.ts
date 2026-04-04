import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    if (!["ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const { searchParams } = request.nextUrl;
    const module = searchParams.get("module") || "";
    const action = searchParams.get("action") || "";
    const severity = searchParams.get("severity") || "";
    const userId = searchParams.get("userId") || "";
    const entityType = searchParams.get("entityType") || "";
    const search = searchParams.get("search") || "";
    const dateFrom = searchParams.get("dateFrom") || "";
    const dateTo = searchParams.get("dateTo") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") || "25", 10)));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (module) where.module = module;
    if (action) where.action = action;
    if (severity) where.severity = severity;
    if (userId) where.userId = userId;
    if (entityType) where.entityType = entityType;

    if (search) {
      where.OR = [
        { entityName: { contains: search } },
        { userName: { contains: search } },
        { notes: { contains: search } },
        { action: { contains: search } },
      ];
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo + "T23:59:59.999Z");
    }

    const [logs, total, stats] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, role: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
      Promise.all([
        prisma.auditLog.count({ where: { severity: "CRITICAL" } }),
        prisma.auditLog.count({ where: { severity: "WARN" } }),
        prisma.auditLog.count(),
        prisma.auditLog.count({
          where: {
            createdAt: {
              gte: new Date(new Date().setHours(0, 0, 0, 0)),
            },
          },
        }),
      ]),
    ]);

    return NextResponse.json({
      logs,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      stats: {
        critical: stats[0],
        warnings: stats[1],
        total: stats[2],
        today: stats[3],
      },
    });
  } catch (error) {
    console.error("Error fetching audit logs:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

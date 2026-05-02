import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { logger } from "@/lib/logger";
import { parsePagination, paginationMeta } from "@/lib/pagination";
import type { Prisma } from "@/generated/prisma/client";

// ═══════════════════════════════════════════════════════════════════════
// /api/issues
// ═══════════════════════════════════════════════════════════════════════
// Admin / manager dashboard view of every project issue raised by an
// executor (or anyone else) via the task toolbar. Joined with the
// ProjectRecordItem envelope and the project / reporter so the page
// can render everything in one card without a second hop.

const ALLOWED_STATUS = ["OPEN", "ACKNOWLEDGED", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;
const ALLOWED_SEVERITY = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

// Severity → numeric weight for ORDER BY (Prisma can't sort enums by
// custom order natively).
const SEVERITY_RANK: Record<string, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

export async function GET(request: NextRequest) {
  try {
    await requireRole(["ADMIN", "MANAGER"]);

    const url = new URL(request.url);
    const sp = url.searchParams;
    const { take, skip, page } = parsePagination(url, 30, 100);

    const where: Prisma.ProjectIssueWhereInput = {};

    const status = sp.get("status");
    if (status && (ALLOWED_STATUS as readonly string[]).includes(status)) {
      where.status = status as (typeof ALLOWED_STATUS)[number];
    }

    const severity = sp.get("severity");
    if (severity && (ALLOWED_SEVERITY as readonly string[]).includes(severity)) {
      where.severity = severity as (typeof ALLOWED_SEVERITY)[number];
    }

    const projectId = sp.get("projectId");
    if (projectId) {
      where.recordItem = { projectId };
    }

    const search = (sp.get("search") || "").trim();
    if (search) {
      where.recordItem = {
        ...(where.recordItem as object || {}),
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ],
      };
    }

    const [rows, total, openCount, inProgressCount, resolvedTodayCount] = await Promise.all([
      prisma.projectIssue.findMany({
        where,
        skip,
        take,
        orderBy: [{ createdAt: "desc" }],
        include: {
          recordItem: {
            select: {
              id: true,
              title: true,
              description: true,
              createdAt: true,
              project: {
                select: {
                  id: true,
                  name: true,
                  projectCode: true,
                  status: true,
                  client: { select: { id: true, name: true } },
                },
              },
              service: { select: { id: true, name: true } },
              taskLinks: {
                select: {
                  task: {
                    select: { id: true, title: true, assigneeId: true },
                  },
                },
                take: 1,
              },
            },
          },
          reportedBy: { select: { id: true, name: true } },
          assignedTo: { select: { id: true, name: true } },
        },
      }),
      prisma.projectIssue.count({ where }),
      prisma.projectIssue.count({ where: { status: "OPEN" } }),
      prisma.projectIssue.count({ where: { status: "IN_PROGRESS" } }),
      prisma.projectIssue.count({
        where: {
          status: "RESOLVED",
          resolvedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
    ]);

    // Sort by severity rank desc client-side (in-page sort over the page).
    const items = rows
      .map((r) => ({ ...r, _severityRank: SEVERITY_RANK[r.severity] || 0 }))
      .sort((a, b) => b._severityRank - a._severityRank);

    return NextResponse.json({
      items,
      counters: {
        open: openCount,
        inProgress: inProgressCount,
        resolvedToday: resolvedTodayCount,
      },
      ...paginationMeta(total, page, take),
    });
  } catch (e) {
    if (e instanceof Response) return e;
    logger.error("issues GET", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { logger } from "@/lib/logger";
import { createNotification } from "@/lib/notifications";

// ═══════════════════════════════════════════════════════════════════════
// /api/issues/[id]
// ═══════════════════════════════════════════════════════════════════════
// PATCH lets ADMIN/MANAGER advance an issue's lifecycle:
//   { action: "start" }    → status = IN_PROGRESS, assignedToId = self
//   { action: "resolve", resolution } → status = RESOLVED, resolvedAt set
//                                       reporter gets a notification
//   { action: "close" }    → status = CLOSED
//   { action: "acknowledge" } → status = ACKNOWLEDGED, acknowledgedAt set

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRole(["ADMIN", "MANAGER"]);
    const { id } = await params;

    const issue = await prisma.projectIssue.findUnique({
      where: { id },
      include: {
        recordItem: {
          select: { id: true, title: true, projectId: true },
        },
      },
    });
    if (!issue) {
      return NextResponse.json({ error: "غير موجود" }, { status: 404 });
    }

    const body = await request.json();
    const action = String(body.action ?? "");

    let updated;
    if (action === "start") {
      updated = await prisma.projectIssue.update({
        where: { id },
        data: {
          status: "IN_PROGRESS",
          assignedToId: session.user.id,
          acknowledgedAt: issue.acknowledgedAt ?? new Date(),
        },
      });
    } else if (action === "acknowledge") {
      updated = await prisma.projectIssue.update({
        where: { id },
        data: {
          status: "ACKNOWLEDGED",
          acknowledgedAt: new Date(),
        },
      });
    } else if (action === "resolve") {
      const resolution = String(body.resolution || "").trim();
      if (!resolution) {
        return NextResponse.json(
          { error: "نص الحل مطلوب" },
          { status: 400 }
        );
      }
      updated = await prisma.projectIssue.update({
        where: { id },
        data: {
          status: "RESOLVED",
          resolvedAt: new Date(),
          resolution,
        },
      });
      // Notify the reporter that their issue has been resolved.
      createNotification({
        userId: issue.reportedById,
        type: "TASK_UPDATE",
        message: `تم حلّ المشكلة التي بلّغت عنها: ${issue.recordItem.title}`,
        link: `/dashboard/projects/${issue.recordItem.projectId}/record`,
      }).catch(() => {});
    } else if (action === "close") {
      updated = await prisma.projectIssue.update({
        where: { id },
        data: { status: "CLOSED" },
      });
    } else {
      return NextResponse.json({ error: "إجراء غير صالح" }, { status: 400 });
    }

    return NextResponse.json(updated);
  } catch (e) {
    if (e instanceof Response) return e;
    logger.error("issues PATCH", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

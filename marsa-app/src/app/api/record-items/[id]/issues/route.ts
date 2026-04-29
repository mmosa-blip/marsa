import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { appendRecordAudit } from "@/lib/record-audit";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Issue management against a record item of kind=ISSUE.
 *
 *   GET   — fetch the issue sibling.
 *   PATCH — body: { status?, severity?, resolution?, assignedToId? }.
 *
 * State transitions allowed (no enforcement of order — admins can move
 * an issue to any status):
 *   ACKNOWLEDGED — sets `acknowledgedAt`. Anyone with project access.
 *   IN_PROGRESS  — admin / manager / assignee.
 *   RESOLVED     — admin / manager / assignee. `resolution` required.
 *   CLOSED       — admin / manager only.
 *
 * Auditing: every transition lands in `RecordItemAuditLog` so the modal
 * in Tier 6 has a paper trail.
 */

const ALLOWED_STATUS = [
  "OPEN",
  "ACKNOWLEDGED",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
] as const;

const ALLOWED_SEVERITY = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    const issue = await prisma.projectIssue.findUnique({
      where: { recordItemId: id },
      include: {
        reportedBy: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    });
    if (!issue) {
      return NextResponse.json({ error: "غير موجود" }, { status: 404 });
    }
    return NextResponse.json(issue);
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("issues GET", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const role = session.user.role;
    const userId = session.user.id;

    const issue = await prisma.projectIssue.findUnique({
      where: { recordItemId: id },
    });
    if (!issue) {
      return NextResponse.json({ error: "غير موجود" }, { status: 404 });
    }

    const body = await request.json();
    const data: Prisma.ProjectIssueUncheckedUpdateInput = {};
    let auditAction: string | null = null;

    if (typeof body.status === "string") {
      if (!(ALLOWED_STATUS as readonly string[]).includes(body.status)) {
        return NextResponse.json({ error: "حالة غير صالحة" }, { status: 400 });
      }
      const isAdminOrManager = role === "ADMIN" || role === "MANAGER";
      const isAssignee = issue.assignedToId === userId;

      if (body.status === "ACKNOWLEDGED") {
        data.status = "ACKNOWLEDGED";
        data.acknowledgedAt = new Date();
        auditAction = "ISSUE_ACKNOWLEDGED";
      } else if (body.status === "IN_PROGRESS") {
        if (!isAdminOrManager && !isAssignee) {
          return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
        }
        data.status = "IN_PROGRESS";
        auditAction = "ISSUE_IN_PROGRESS";
      } else if (body.status === "RESOLVED") {
        if (!isAdminOrManager && !isAssignee) {
          return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
        }
        const resolution = String(body.resolution || "").trim();
        if (!resolution) {
          return NextResponse.json(
            { error: "الحل مطلوب" },
            { status: 400 }
          );
        }
        data.status = "RESOLVED";
        data.resolvedAt = new Date();
        data.resolution = resolution;
        auditAction = "ISSUE_RESOLVED";
      } else if (body.status === "CLOSED") {
        if (!isAdminOrManager) {
          return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
        }
        data.status = "CLOSED";
        auditAction = "ISSUE_CLOSED";
      } else if (body.status === "OPEN") {
        if (!isAdminOrManager) {
          return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
        }
        data.status = "OPEN";
        data.acknowledgedAt = null;
        data.resolvedAt = null;
        auditAction = "ISSUE_REOPENED";
      }
    }

    if (typeof body.severity === "string") {
      if (!(ALLOWED_SEVERITY as readonly string[]).includes(body.severity)) {
        return NextResponse.json({ error: "أولوية غير صالحة" }, { status: 400 });
      }
      data.severity = body.severity as (typeof ALLOWED_SEVERITY)[number];
      auditAction = auditAction ?? "ISSUE_SEVERITY_CHANGED";
    }

    if ("assignedToId" in body) {
      if (!(role === "ADMIN" || role === "MANAGER")) {
        return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
      }
      data.assignedToId = body.assignedToId || null;
      auditAction = auditAction ?? "ISSUE_REASSIGNED";
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "لا يوجد تعديل" }, { status: 400 });
    }

    const updated = await prisma.projectIssue.update({
      where: { recordItemId: id },
      data,
      include: {
        reportedBy: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    });

    if (auditAction) {
      await appendRecordAudit({
        recordItemId: id,
        action: auditAction,
        actorId: userId,
        before: {
          status: issue.status,
          severity: issue.severity,
          assignedToId: issue.assignedToId,
        },
        after: {
          status: updated.status,
          severity: updated.severity,
          assignedToId: updated.assignedToId,
        },
      });
    }

    return NextResponse.json(updated);
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("issues PATCH", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

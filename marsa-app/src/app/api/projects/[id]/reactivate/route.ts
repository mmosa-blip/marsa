import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { logger } from "@/lib/logger";
import { createAuditLog, AuditModule } from "@/lib/audit";
import { createNotifications } from "@/lib/notifications";

// ═══════════════════════════════════════════════════════════════════════
// POST /api/projects/[id]/reactivate
// ═══════════════════════════════════════════════════════════════════════
// Used by the city canvas's 🔄 button on COLLAPSED buildings. Extends
// the project deadline (the reason it was COLLAPSED in the first place)
// and flips status back to ACTIVE so the team can resume working. The
// admin records WHY (verbal extension, scope renegotiation, etc.) so
// the audit log carries a real story instead of "deadline magically
// jumped 3 weeks".
//
// Body: { newDeadline: string (ISO date), reason?: string }

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRole(["ADMIN", "MANAGER"]);
    const { id } = await params;
    const body = await request.json();

    const newDeadlineStr = String(body.newDeadline ?? "").trim();
    if (!newDeadlineStr) {
      return NextResponse.json({ error: "تاريخ النهاية الجديد مطلوب" }, { status: 400 });
    }
    const newDeadline = new Date(newDeadlineStr);
    if (Number.isNaN(newDeadline.getTime())) {
      return NextResponse.json({ error: "تاريخ غير صالح" }, { status: 400 });
    }
    // Floor today to midnight so a same-day extension still counts as
    // "in the future" relative to the past-blown deadline.
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (newDeadline.getTime() < today.getTime()) {
      return NextResponse.json(
        { error: "التاريخ الجديد يجب أن يكون اليوم أو في المستقبل" },
        { status: 400 }
      );
    }

    const reason = body.reason?.toString().trim() || null;

    const project = await prisma.project.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        endDate: true,
        contractEndDate: true,
        status: true,
        isPaused: true,
        deletedAt: true,
        tasks: {
          where: { assigneeId: { not: null }, deletedAt: null },
          select: { assigneeId: true },
        },
      },
    });
    if (!project || project.deletedAt) {
      return NextResponse.json({ error: "المشروع غير موجود" }, { status: 404 });
    }

    const beforeSnapshot = {
      endDate: project.endDate,
      contractEndDate: project.contractEndDate,
      status: project.status,
      isPaused: project.isPaused,
    };

    // Extend the deadline + reset to ACTIVE. Both denormalised endDate
    // fields move; the live contract.endDate is left alone because
    // editing it implies a contract amendment which is a separate flow.
    const updated = await prisma.project.update({
      where: { id },
      data: {
        endDate: newDeadline,
        ...(project.contractEndDate ? { contractEndDate: newDeadline } : {}),
        status: "ACTIVE",
        isPaused: false,
      },
      select: { id: true, endDate: true, status: true },
    });

    // Audit log — record WHO extended, WHY, and from / to dates so the
    // history page can reconstruct the conversation if anything goes wrong.
    await createAuditLog({
      userId: session.user.id,
      userName: session.user.name ?? undefined,
      userRole: session.user.role,
      action: "PROJECT_REACTIVATED",
      module: AuditModule.PROJECTS,
      severity: "WARN",
      entityType: "Project",
      entityId: project.id,
      entityName: project.name,
      before: beforeSnapshot,
      after: {
        endDate: updated.endDate,
        status: updated.status,
        reason,
      },
    });

    // Notify every executor currently holding a task on this project so
    // their next page load doesn't surprise them with a new deadline.
    const assigneeIds = Array.from(
      new Set(
        project.tasks
          .map((t) => t.assigneeId)
          .filter((v): v is string => !!v && v !== session.user.id)
      )
    );
    if (assigneeIds.length > 0) {
      await createNotifications(
        assigneeIds.map((userId) => ({
          userId,
          type: "PROJECT_STATUS_CHANGE" as const,
          message: `تم إعادة تنشيط المشروع: ${project.name} — موعد التسليم الجديد ${newDeadline.toLocaleDateString("ar-SA-u-nu-latn")}`,
          link: `/dashboard/projects/${id}`,
        }))
      );
    }

    return NextResponse.json({
      id: updated.id,
      endDate: updated.endDate,
      status: updated.status,
      reason,
    });
  } catch (e) {
    if (e instanceof Response) return e;
    logger.error("project reactivate error", e);
    return NextResponse.json({ error: "فشل إعادة تنشيط المشروع" }, { status: 500 });
  }
}

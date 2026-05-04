import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createNotifications } from "@/lib/notifications";
import { requireRole } from "@/lib/api-auth";

// OVERDUE_REVIEW was added so admins can pause a COLLAPSED project for
// accountability review without changing the deadline (the reactivate
// flow is the one that extends deadlines). The legacy three values
// stay so the operations-room UI keeps working unmodified.
const ALLOWED_REASONS = [
  "PAYMENT_DELAY",
  "CLIENT_REQUEST",
  "OTHER",
  "OVERDUE_REVIEW",
] as const;
type PauseReason = (typeof ALLOWED_REASONS)[number];

// POST /api/projects/[id]/pause
// body: { reason, notes }
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRole(["ADMIN", "MANAGER"]);

    const { id } = await params;
    const body = await req.json();
    const { reason, notes } = body || {};

    if (!reason || !ALLOWED_REASONS.includes(reason as PauseReason)) {
      return NextResponse.json(
        { error: "سبب الإيقاف مطلوب (PAYMENT_DELAY | CLIENT_REQUEST | OTHER | OVERDUE_REVIEW)" },
        { status: 400 }
      );
    }

    const project = await prisma.project.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        isPaused: true,
        tasks: {
          where: { assigneeId: { not: null }, deletedAt: null },
          select: { assigneeId: true },
        },
      },
    });
    if (!project) {
      return NextResponse.json({ error: "المشروع غير موجود" }, { status: 404 });
    }
    if (project.isPaused) {
      return NextResponse.json(
        { error: "المشروع موقوف مسبقاً" },
        { status: 409 }
      );
    }

    const pause = await prisma.projectPause.create({
      data: {
        projectId: id,
        reason,
        notes: typeof notes === "string" && notes.trim() ? notes.trim() : null,
        pausedById: session.user.id,
      },
    });

    await prisma.project.update({
      where: { id },
      data: { isPaused: true, status: "ON_HOLD" },
    });

    // Notify every distinct assignee currently holding a task in this project.
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
          message: `تم إيقاف المشروع: ${project.name}`,
          link: `/dashboard/projects/${id}`,
        }))
      );
    }

    return NextResponse.json(pause, { status: 201 });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("pause error:", e);
    return NextResponse.json({ error: "فشل إيقاف المشروع" }, { status: 500 });
  }
}

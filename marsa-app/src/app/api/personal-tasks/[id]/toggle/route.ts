import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { logger } from "@/lib/logger";

// POST /api/personal-tasks/[id]/toggle
//
// Flips a personal task's completion state in one round-trip:
//   PENDING / IN_PROGRESS → DONE   (stamps completedAt)
//   DONE                  → PENDING (clears completedAt)
//
// Owner-only. A non-owner gets 404 — same masking convention as the
// CRUD endpoints in this folder.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const existing = await prisma.personalTask.findUnique({
      where: { id },
      select: { id: true, ownerId: true, status: true },
    });
    if (!existing || existing.ownerId !== session.user.id) {
      return NextResponse.json({ error: "المهمة غير موجودة" }, { status: 404 });
    }

    const goingToDone = existing.status !== "DONE";
    const updated = await prisma.personalTask.update({
      where: { id },
      data: {
        status: goingToDone ? "DONE" : "PENDING",
        completedAt: goingToDone ? new Date() : null,
      },
      include: { requestedBy: { select: { id: true, name: true } } },
    });
    return NextResponse.json(updated);
  } catch (e) {
    if (e instanceof Response) return e;
    logger.error("personal-tasks toggle error", e);
    return NextResponse.json({ error: "فشل تحديث الحالة" }, { status: 500 });
  }
}

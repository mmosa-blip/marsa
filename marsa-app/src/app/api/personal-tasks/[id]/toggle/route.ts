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
// Recurring spawn: when the row's `isRecurring` is true AND we're
// transitioning to DONE AND the row carries a recurrencePattern, a
// fresh PENDING instance is created with the next dueDate (the
// original stays DONE for history). Going DONE → PENDING (revert)
// does NOT spawn — that path is meant for fixing a wrong toggle.
//
// Inherited fields on the spawned instance: title, description,
// priority, requestedById, isRecurring, recurrencePattern,
// recurrenceDays, notes. Intentionally NOT inherited: dueTime —
// the spec keeps the time pinned on the original row only.
//
// Owner-only. A non-owner gets 404 — same masking convention as
// the CRUD endpoints in this folder.

function nextDueDate(base: Date, pattern: string): Date {
  // Normalize to start-of-day so repeated cycles don't drift forward
  // by hours each time (start-of-day + 1 day stays at start-of-day).
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  if (pattern === "DAILY") {
    d.setDate(d.getDate() + 1);
    return d;
  }
  if (pattern === "WEEKLY") {
    d.setDate(d.getDate() + 7);
    return d;
  }
  if (pattern === "MONTHLY") {
    // setMonth(+1) handles year rollover; if the source day doesn't
    // exist in the next month (e.g. Jan 31 → Feb), JS rolls it forward
    // (Feb 31 → Mar 3). Acceptable for a personal todo list — the
    // executor can edit the date if the rollover surprises them.
    d.setMonth(d.getMonth() + 1);
    return d;
  }
  // Unknown pattern → treat as daily as a safe default.
  d.setDate(d.getDate() + 1);
  return d;
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const existing = await prisma.personalTask.findUnique({
      where: { id },
      select: {
        id: true,
        ownerId: true,
        status: true,
        title: true,
        description: true,
        dueDate: true,
        isRecurring: true,
        recurrencePattern: true,
        recurrenceDays: true,
        priority: true,
        requestedById: true,
        notes: true,
      },
    });
    if (!existing || existing.ownerId !== session.user.id) {
      return NextResponse.json({ error: "المهمة غير موجودة" }, { status: 404 });
    }

    const goingToDone = existing.status !== "DONE";
    const now = new Date();

    const updated = await prisma.personalTask.update({
      where: { id },
      data: {
        status: goingToDone ? "DONE" : "PENDING",
        completedAt: goingToDone ? now : null,
      },
      include: { requestedBy: { select: { id: true, name: true } } },
    });

    // Spawn the next recurring instance only on the PENDING → DONE
    // transition. The pattern is required (the API ensures it's set
    // when isRecurring=true; a defensive null-check still skips here
    // for older rows that may have drifted).
    let spawnedId: string | null = null;
    if (goingToDone && existing.isRecurring && existing.recurrencePattern) {
      const base = existing.dueDate ?? now;
      const due = nextDueDate(base, existing.recurrencePattern);
      try {
        const spawn = await prisma.personalTask.create({
          data: {
            ownerId: existing.ownerId,
            title: existing.title,
            description: existing.description,
            dueDate: due,
            // dueTime intentionally not inherited per spec.
            priority: existing.priority,
            requestedById: existing.requestedById,
            isRecurring: true,
            recurrencePattern: existing.recurrencePattern,
            recurrenceDays: existing.recurrenceDays,
            notes: existing.notes,
            // status defaults to PENDING via the schema.
          },
          select: { id: true },
        });
        spawnedId = spawn.id;
      } catch (e) {
        // Best-effort spawn — a failure here must not roll back the
        // user's "DONE" click. They can re-create manually if needed.
        logger.warn("personal-task recurring spawn failed", { id, e: String(e) });
      }
    }

    return NextResponse.json({ ...updated, spawnedNextId: spawnedId });
  } catch (e) {
    if (e instanceof Response) return e;
    logger.error("personal-tasks toggle error", e);
    return NextResponse.json({ error: "فشل تحديث الحالة" }, { status: 500 });
  }
}

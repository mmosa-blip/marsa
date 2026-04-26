import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { logger } from "@/lib/logger";

// GET / PATCH / DELETE /api/personal-tasks/[id]
//
// All three actions are gated to the row's owner — there is no admin
// override, by design: personal tasks are private to the user. A
// non-owner request returns 404 (not 403) so we don't even leak the
// existence of someone else's row.

async function loadOwned(id: string, userId: string) {
  const row = await prisma.personalTask.findUnique({
    where: { id },
    include: { requestedBy: { select: { id: true, name: true } } },
  });
  if (!row || row.ownerId !== userId) return null;
  return row;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const row = await loadOwned(id, session.user.id);
    if (!row) return NextResponse.json({ error: "المهمة غير موجودة" }, { status: 404 });
    return NextResponse.json(row);
  } catch (e) {
    if (e instanceof Response) return e;
    logger.error("personal-tasks GET[id] error", e);
    return NextResponse.json({ error: "فشل تحميل المهمة" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const existing = await loadOwned(id, session.user.id);
    if (!existing) return NextResponse.json({ error: "المهمة غير موجودة" }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const data: Record<string, unknown> = {};

    if (typeof body?.title === "string") {
      const trimmed = body.title.trim();
      if (trimmed.length === 0) {
        return NextResponse.json({ error: "العنوان لا يمكن أن يكون فارغاً" }, { status: 400 });
      }
      data.title = trimmed;
    }
    if ("description" in body) {
      data.description = typeof body.description === "string" ? body.description : null;
    }
    if ("notes" in body) {
      data.notes = typeof body.notes === "string" ? body.notes : null;
    }
    if ("dueDate" in body) {
      if (body.dueDate === null || body.dueDate === "") {
        data.dueDate = null;
      } else {
        const d = new Date(body.dueDate);
        if (Number.isNaN(d.getTime())) {
          return NextResponse.json({ error: "تاريخ الاستحقاق غير صالح" }, { status: 400 });
        }
        data.dueDate = d;
      }
    }
    if ("dueTime" in body) {
      if (body.dueTime === null || body.dueTime === "") {
        data.dueTime = null;
      } else if (typeof body.dueTime === "string" && /^\d{2}:\d{2}$/.test(body.dueTime)) {
        data.dueTime = body.dueTime;
      } else {
        return NextResponse.json({ error: "صيغة الوقت غير صحيحة" }, { status: 400 });
      }
    }
    if ("priority" in body) {
      if (["LOW", "NORMAL", "HIGH"].includes(body.priority)) {
        data.priority = body.priority;
      }
    }
    if ("status" in body) {
      if (["PENDING", "IN_PROGRESS", "DONE"].includes(body.status)) {
        data.status = body.status;
        data.completedAt = body.status === "DONE" ? new Date() : null;
      } else {
        return NextResponse.json({ error: "حالة غير صالحة" }, { status: 400 });
      }
    }
    if ("requestedById" in body) {
      if (body.requestedById === null || body.requestedById === "") {
        data.requestedById = null;
      } else if (typeof body.requestedById === "string") {
        const u = await prisma.user.findUnique({
          where: { id: body.requestedById },
          select: { id: true, isActive: true, deletedAt: true },
        });
        if (!u || u.deletedAt || !u.isActive) {
          return NextResponse.json({ error: "الطالب غير صالح" }, { status: 400 });
        }
        data.requestedById = body.requestedById;
      }
    }
    if ("isRecurring" in body) data.isRecurring = !!body.isRecurring;
    if ("recurrencePattern" in body) {
      data.recurrencePattern =
        ["DAILY", "WEEKLY", "MONTHLY"].includes(body.recurrencePattern)
          ? body.recurrencePattern
          : null;
    }
    if ("recurrenceDays" in body) {
      data.recurrenceDays = typeof body.recurrenceDays === "string" ? body.recurrenceDays : null;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(existing);
    }

    const updated = await prisma.personalTask.update({
      where: { id },
      data,
      include: { requestedBy: { select: { id: true, name: true } } },
    });
    return NextResponse.json(updated);
  } catch (e) {
    if (e instanceof Response) return e;
    logger.error("personal-tasks PATCH[id] error", e);
    return NextResponse.json({ error: "فشل تحديث المهمة" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const existing = await loadOwned(id, session.user.id);
    if (!existing) return NextResponse.json({ error: "المهمة غير موجودة" }, { status: 404 });

    await prisma.personalTask.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    logger.error("personal-tasks DELETE[id] error", e);
    return NextResponse.json({ error: "فشل حذف المهمة" }, { status: 500 });
  }
}

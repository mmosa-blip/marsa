import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { logger } from "@/lib/logger";

// GET /api/personal-tasks?filter=today|week|all
//
// Lists the current user's personal todo items. Filter narrows by
// dueDate window:
//   today → dueDate falls inside [start-of-today, end-of-today]
//   week  → dueDate falls inside the next 7 days from start-of-today
//   all   → no date filter (default)
//
// Returns rows ordered by (dueDate asc nulls last), priority desc,
// createdAt desc — undated items sink to the bottom of each priority
// bucket.
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const filter = (new URL(req.url).searchParams.get("filter") ?? "all").toLowerCase();

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
    const endOfWeek = new Date(startOfToday.getTime() + 7 * 24 * 60 * 60 * 1000);

    const where: { ownerId: string; dueDate?: { gte?: Date; lt?: Date } } = {
      ownerId: session.user.id,
    };
    if (filter === "today") {
      where.dueDate = { gte: startOfToday, lt: endOfToday };
    } else if (filter === "week") {
      where.dueDate = { gte: startOfToday, lt: endOfWeek };
    }

    const tasks = await prisma.personalTask.findMany({
      where,
      include: {
        requestedBy: { select: { id: true, name: true } },
      },
      // Prisma doesn't support multi-key composite ordering with custom
      // priority weighting in one query, so we sort here for natural
      // (dueDate asc nulls last) and re-sort priority client-side via
      // the JS sort below.
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    });

    const priorityWeight: Record<string, number> = { HIGH: 0, NORMAL: 1, LOW: 2 };
    tasks.sort((a, b) => {
      // Primary: dueDate asc, nulls last.
      const ad = a.dueDate ? a.dueDate.getTime() : Number.POSITIVE_INFINITY;
      const bd = b.dueDate ? b.dueDate.getTime() : Number.POSITIVE_INFINITY;
      if (ad !== bd) return ad - bd;
      // Secondary: priority HIGH > NORMAL > LOW.
      const ap = priorityWeight[a.priority] ?? 1;
      const bp = priorityWeight[b.priority] ?? 1;
      if (ap !== bp) return ap - bp;
      // Tertiary: createdAt desc.
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    return NextResponse.json(tasks);
  } catch (e) {
    if (e instanceof Response) return e;
    logger.error("personal-tasks GET error", e);
    return NextResponse.json({ error: "فشل تحميل المهام" }, { status: 500 });
  }
}

// POST /api/personal-tasks
// Body: { title, description?, dueDate?, dueTime?, requestedById?,
//         isRecurring?, recurrencePattern?, recurrenceDays?,
//         priority?, notes? }
//
// `title` is required and non-empty. `requestedById`, when present,
// must reference an existing active user — otherwise 400.
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await req.json().catch(() => ({}));

    const title = typeof body?.title === "string" ? body.title.trim() : "";
    if (title.length === 0) {
      return NextResponse.json({ error: "العنوان مطلوب" }, { status: 400 });
    }

    const requestedById =
      typeof body?.requestedById === "string" && body.requestedById.length > 0
        ? body.requestedById
        : null;
    if (requestedById) {
      const u = await prisma.user.findUnique({
        where: { id: requestedById },
        select: { id: true, isActive: true, deletedAt: true },
      });
      if (!u || u.deletedAt || !u.isActive) {
        return NextResponse.json({ error: "الطالب غير صالح" }, { status: 400 });
      }
    }

    const priority =
      ["LOW", "NORMAL", "HIGH"].includes(body?.priority) ? body.priority : "NORMAL";
    const recurrencePattern =
      ["DAILY", "WEEKLY", "MONTHLY"].includes(body?.recurrencePattern)
        ? body.recurrencePattern
        : null;
    const isRecurring = !!body?.isRecurring && !!recurrencePattern;

    const dueDate = body?.dueDate ? new Date(body.dueDate) : null;
    if (dueDate && Number.isNaN(dueDate.getTime())) {
      return NextResponse.json({ error: "تاريخ الاستحقاق غير صالح" }, { status: 400 });
    }
    const dueTime =
      typeof body?.dueTime === "string" && /^\d{2}:\d{2}$/.test(body.dueTime)
        ? body.dueTime
        : null;

    const created = await prisma.personalTask.create({
      data: {
        ownerId: session.user.id,
        title,
        description: typeof body?.description === "string" ? body.description : null,
        dueDate,
        dueTime,
        requestedById,
        priority,
        isRecurring,
        recurrencePattern,
        recurrenceDays: typeof body?.recurrenceDays === "string" ? body.recurrenceDays : null,
        notes: typeof body?.notes === "string" ? body.notes : null,
      },
      include: { requestedBy: { select: { id: true, name: true } } },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    if (e instanceof Response) return e;
    logger.error("personal-tasks POST error", e);
    return NextResponse.json({ error: "فشل إنشاء المهمة" }, { status: 500 });
  }
}

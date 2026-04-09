import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/projects/[id]/pause-report
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const { id } = await params;

    const project = await prisma.project.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        contractEndDate: true,
        isPaused: true,
        pauses: {
          orderBy: { startDate: "asc" },
          include: {
            pausedBy: { select: { id: true, name: true } },
            resumedBy: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "المشروع غير موجود" }, { status: 404 });
    }

    const now = new Date();
    const MS_PER_DAY = 1000 * 60 * 60 * 24;

    const periods = project.pauses.map((p) => {
      const start = new Date(p.startDate);
      const end = p.endDate ? new Date(p.endDate) : now;
      const days = Math.max(0, Math.ceil((end.getTime() - start.getTime()) / MS_PER_DAY));
      return {
        id: p.id,
        reason: p.reason,
        notes: p.notes,
        startDate: start.toISOString(),
        endDate: p.endDate ? end.toISOString() : null,
        isOpen: !p.endDate,
        days,
        pausedBy: p.pausedBy,
        resumedBy: p.resumedBy,
      };
    });

    const totalPausedDays = periods.reduce((s, p) => s + p.days, 0);

    // Adjusted end date = originalEnd + totalPausedDays. Prefer
    // contractEndDate when available, fall back to project.endDate.
    const baseEnd = project.contractEndDate || project.endDate;
    const adjustedEndDate = baseEnd
      ? new Date(new Date(baseEnd).getTime() + totalPausedDays * MS_PER_DAY).toISOString()
      : null;

    return NextResponse.json({
      projectId: project.id,
      projectName: project.name,
      startDate: project.startDate,
      originalEndDate: baseEnd,
      adjustedEndDate,
      isPaused: project.isPaused,
      totalPausedDays,
      periods,
    });
  } catch (e) {
    console.error("pause-report error:", e);
    return NextResponse.json({ error: "فشل تحميل تقرير الإيقاف" }, { status: 500 });
  }
}

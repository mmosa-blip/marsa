import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createNotifications } from "@/lib/notifications";

// POST /api/projects/[id]/resume
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const { id } = await params;

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
    if (!project.isPaused) {
      return NextResponse.json(
        { error: "المشروع غير موقوف" },
        { status: 409 }
      );
    }

    // Close the most recent open pause row (endDate null).
    const openPause = await prisma.projectPause.findFirst({
      where: { projectId: id, endDate: null },
      orderBy: { startDate: "desc" },
    });
    if (openPause) {
      await prisma.projectPause.update({
        where: { id: openPause.id },
        data: { endDate: new Date(), resumedById: session.user.id },
      });
    }

    await prisma.project.update({
      where: { id },
      data: { isPaused: false, status: "ACTIVE" },
    });

    // Notify assignees that work is back on.
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
          message: `تم استئناف المشروع: ${project.name}`,
          link: `/dashboard/projects/${id}`,
        }))
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("resume error:", e);
    return NextResponse.json({ error: "فشل استئناف المشروع" }, { status: 500 });
  }
}

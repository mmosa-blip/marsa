import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
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
      include: {
        client: { select: { id: true, name: true, email: true } },
        manager: { select: { id: true, name: true, email: true } },
        department: { select: { id: true, name: true, nameEn: true, color: true } },
        services: {
          include: {
            tasks: {
              include: {
                assignee: { select: { id: true, name: true, avatar: true } },
                service: { select: { id: true, name: true, category: true } },
              },
              orderBy: [{ order: "asc" }],
            },
          },
        },
        tasks: {
          include: {
            service: { select: { id: true, name: true, category: true } },
            assignee: { select: { id: true, name: true, avatar: true } },
          },
          orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "المشروع غير موجود" }, { status: 404 });
    }

    const total = project.tasks.length;
    const done = project.tasks.filter((t) => t.status === "DONE").length;

    return NextResponse.json({
      ...project,
      progress: total > 0 ? Math.round((done / total) * 100) : 0,
      totalTasks: total,
      completedTasks: done,
    });
  } catch (error) {
    console.error("Error fetching project:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const project = await prisma.project.update({
      where: { id },
      data: body,
    });

    return NextResponse.json(project);
  } catch (error) {
    console.error("Error updating project:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const { id } = await params;

    await prisma.project.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    // Unassign all tasks in this project
    await prisma.task.updateMany({
      where: { projectId: id },
      data: { assigneeId: null, assignedAt: null },
    });

    return NextResponse.json({ message: "تم حذف المشروع" });
  } catch (error) {
    console.error("Error deleting project:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

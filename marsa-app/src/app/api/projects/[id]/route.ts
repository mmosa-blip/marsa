import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/api-auth";
import { notifyProjectAssignment } from "@/lib/notifications";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();

    const { id } = await params;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true, email: true } },
        manager: { select: { id: true, name: true, email: true } },
        department: { select: { id: true, name: true, nameEn: true, color: true } },
        contract: {
          select: {
            id: true,
            contractNumber: true,
            startDate: true,
            endDate: true,
            durationDays: true,
            contractValue: true,
            uploadedFileUrl: true,
            templateId: true,
            status: true,
          },
        },
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
          orderBy: [{ serviceOrder: "asc" }],
        },
        tasks: {
          include: {
            service: { select: { id: true, name: true, category: true } },
            assignee: { select: { id: true, name: true, avatar: true } },
          },
          orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        },
        paymentSchedule: {
          orderBy: { dueDate: "asc" },
        },
        // Project milestones — the detail page's timeline uses these to
        // render the "قبل البداية" payment badge (order === -1) above
        // the first service.
        milestones: {
          orderBy: { order: "asc" },
          include: {
            invoice: { select: { id: true, invoiceNumber: true, totalAmount: true, status: true } },
          },
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
    if (error instanceof Response) return error;
    console.error("Error fetching project:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();

    const { id } = await params;
    const body = await request.json();

    // Snapshot the manager BEFORE the update so we can detect whether the
    // manager actually changed and only notify in that case.
    const before = await prisma.project.findUnique({
      where: { id },
      select: { managerId: true },
    });

    const project = await prisma.project.update({
      where: { id },
      data: body,
    });

    // PROJECT_ASSIGNED notification — only when the manager has actually
    // changed to a different user. Best-effort, never blocks the response.
    if (
      project.managerId &&
      project.managerId !== before?.managerId
    ) {
      await notifyProjectAssignment({
        projectId: project.id,
        userIds: [project.managerId],
        excludeUserId: session.user.id,
      });
    }

    return NextResponse.json(project);
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error updating project:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["ADMIN", "MANAGER"]);

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
    if (error instanceof Response) return error;
    console.error("Error deleting project:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

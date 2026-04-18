import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/projects/[id]/task-requirements
// Returns all completed tasks in the project that had requirement values saved.
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

    // Include tasks that either have saved values OR have a template
    // with requirements (so pending ones show too).
    const tasks = await prisma.task.findMany({
      where: {
        projectId: id,
        deletedAt: null,
        OR: [
          { requirementValues: { some: {} } },
          { taskTemplate: { requirements: { some: {} } } },
        ],
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        status: true,
        updatedAt: true,
        service: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true } },
        taskTemplate: {
          select: {
            requirements: {
              orderBy: [{ order: "asc" }, { createdAt: "asc" }],
              select: {
                id: true,
                label: true,
                type: true,
              },
            },
          },
        },
        requirementValues: {
          select: {
            requirementId: true,
            textValue: true,
            fileUrl: true,
            selectedOption: true,
            updatedAt: true,
          },
        },
      },
    });

    const shaped = tasks.map((t) => {
      const valueMap = new Map(t.requirementValues.map((v) => [v.requirementId, v]));
      const requirements = (t.taskTemplate?.requirements || []).map((r) => ({
        id: r.id,
        label: r.label,
        type: r.type,
        value: valueMap.get(r.id) || null,
      }));
      return {
        id: t.id,
        title: t.title,
        status: t.status,
        updatedAt: t.updatedAt,
        service: t.service,
        assignee: t.assignee,
        requirements,
      };
    });

    return NextResponse.json(shaped);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "فشل التحميل" }, { status: 500 });
  }
}

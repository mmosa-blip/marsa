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

    // Return every task whose template defines at least one requirement,
    // regardless of whether the executor has filled values or not.
    const tasks = await prisma.task.findMany({
      where: {
        projectId: id,
        deletedAt: null,
        taskTemplate: {
          requirements: { some: {} },
        },
      },
      include: {
        taskTemplate: {
          include: {
            requirements: { orderBy: { order: "asc" } },
          },
        },
        requirementValues: true,
        service: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    const shaped = tasks.map((t) => {
      const valueMap = new Map(
        t.requirementValues.map((v) => [v.requirementId, v])
      );
      const requirements = (t.taskTemplate?.requirements || []).map((r) => ({
        id: r.id,
        label: r.label,
        type: r.type,
        isRequired: r.isRequired,
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

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/tasks/[id]/requirements
// Returns the requirements defined on the task's TaskTemplate, plus any
// values already saved for this task.
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

    const task = await prisma.task.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        taskTemplateId: true,
        taskTemplate: {
          select: {
            requirements: {
              orderBy: [{ order: "asc" }, { createdAt: "asc" }],
            },
          },
        },
        requirementValues: true,
      },
    });

    if (!task) {
      return NextResponse.json({ error: "المهمة غير موجودة" }, { status: 404 });
    }

    const requirements = task.taskTemplate?.requirements ?? [];
    const valueMap = new Map(task.requirementValues.map((v) => [v.requirementId, v]));

    const withValues = requirements.map((r) => ({
      ...r,
      value: valueMap.get(r.id) || null,
    }));

    return NextResponse.json({
      taskId: task.id,
      taskTitle: task.title,
      requirements: withValues,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "فشل تحميل متطلبات المهمة" }, { status: 500 });
  }
}

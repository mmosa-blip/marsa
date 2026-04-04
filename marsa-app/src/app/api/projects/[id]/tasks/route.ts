import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const tasks = await prisma.task.findMany({
      where: { projectId: id },
      include: {
        service: { select: { id: true, name: true, category: true } },
        assignee: { select: { id: true, name: true, avatar: true } },
      },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    });

    return NextResponse.json(tasks);
  } catch (error) {
    console.error("Error fetching tasks:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

export async function POST(
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
    const { title, serviceId, assigneeId, priority, dueDate } = body;

    if (!title) {
      return NextResponse.json({ error: "عنوان المهمة مطلوب" }, { status: 400 });
    }

    const maxOrder = await prisma.task.findFirst({
      where: { projectId: id },
      orderBy: { order: "desc" },
      select: { order: true },
    });

    const task = await prisma.task.create({
      data: {
        title,
        projectId: id,
        serviceId: serviceId || null,
        assigneeId: assigneeId || null,
        priority: priority || "MEDIUM",
        order: (maxOrder?.order ?? -1) + 1,
        dueDate: dueDate ? new Date(dueDate) : null,
      },
      include: {
        service: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error("Error creating task:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

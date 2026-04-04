import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const { projectId } = await params;

    // Check if conversation exists for this project
    const conversation = await prisma.conversation.findUnique({
      where: { projectId },
      include: {
        users: {
          select: { id: true, name: true, email: true, role: true },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            sender: { select: { id: true, name: true } },
          },
        },
        project: { select: { id: true, name: true } },
      },
    });

    if (!conversation) {
      return NextResponse.json(null);
    }

    return NextResponse.json(conversation);
  } catch (error) {
    console.error("Error fetching project conversation:", error);
    return NextResponse.json(
      { error: "حدث خطأ في جلب محادثة المشروع" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const { projectId } = await params;

    // Check if conversation already exists for this project
    const existing = await prisma.conversation.findUnique({
      where: { projectId },
      include: {
        users: {
          select: { id: true, name: true, email: true, role: true },
        },
        project: { select: { id: true, name: true } },
      },
    });

    if (existing) {
      return NextResponse.json(existing);
    }

    // Find the project with client, manager, and task assignees
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        client: { select: { id: true } },
        manager: { select: { id: true } },
        tasks: {
          where: { assigneeId: { not: null } },
          select: { assigneeId: true },
        },
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "المشروع غير موجود" },
        { status: 404 }
      );
    }

    // Collect all unique user IDs
    const userIdSet = new Set<string>();
    userIdSet.add(project.clientId);
    if (project.managerId) {
      userIdSet.add(project.managerId);
    }
    project.tasks.forEach((task) => {
      if (task.assigneeId) {
        userIdSet.add(task.assigneeId);
      }
    });
    // Include current user
    userIdSet.add(session.user.id);

    const conversation = await prisma.conversation.create({
      data: {
        name: `${project.name} - محادثة المشروع`,
        isGroup: true,
        projectId,
        users: {
          connect: Array.from(userIdSet).map((id) => ({ id })),
        },
      },
      include: {
        users: {
          select: { id: true, name: true, email: true, role: true },
        },
        project: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(conversation, { status: 201 });
  } catch (error) {
    console.error("Error creating project conversation:", error);
    return NextResponse.json(
      { error: "حدث خطأ في إنشاء محادثة المشروع" },
      { status: 500 }
    );
  }
}

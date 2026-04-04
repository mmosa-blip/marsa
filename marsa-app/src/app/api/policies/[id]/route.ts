import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const { id } = await params;

    const policy = await prisma.systemPolicy.findUnique({
      where: { id },
      include: { updatedBy: { select: { name: true } } },
    });

    if (!policy) {
      return NextResponse.json({ error: "غير موجود" }, { status: 404 });
    }

    // Mark notification as read for this user
    await prisma.policyNotification.updateMany({
      where: { policyId: id, userId: session.user.id, readAt: null },
      data: { readAt: new Date() },
    });

    return NextResponse.json(policy);
  } catch (error) {
    console.error("Error fetching policy:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "للأدمن فقط" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { title, content, icon, order, isPublished } = body;

    const policy = await prisma.systemPolicy.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(content !== undefined && { content }),
        ...(icon !== undefined && { icon }),
        ...(order !== undefined && { order }),
        ...(isPublished !== undefined && { isPublished }),
        updatedById: session.user.id,
      },
      include: { updatedBy: { select: { name: true } } },
    });

    // Notify ALL non-admin users about the update
    if (content !== undefined || title !== undefined) {
      const users = await prisma.user.findMany({
        where: { role: { not: "ADMIN" }, deletedAt: null, isActive: true },
        select: { id: true },
      });

      // Upsert policy notifications (reset readAt to null = unread)
      await Promise.all(
        users.map((u) =>
          prisma.policyNotification.upsert({
            where: { policyId_userId: { policyId: id, userId: u.id } },
            create: { policyId: id, userId: u.id },
            update: { readAt: null, createdAt: new Date() },
          })
        )
      );

      // Create system notifications
      await prisma.notification.createMany({
        data: users.map((u) => ({
          userId: u.id,
          type: "TASK_UPDATE" as const,
          message: `تم تحديث لائحة: ${policy.title}`,
          link: "/dashboard/policies",
        })),
      });
    }

    return NextResponse.json(policy);
  } catch (error) {
    console.error("Error updating policy:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "للأدمن فقط" }, { status: 403 });
    }

    const { id } = await params;

    await prisma.policyNotification.deleteMany({ where: { policyId: id } });
    await prisma.systemPolicy.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting policy:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

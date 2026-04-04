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
    if (!session || !["ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const { id } = await params;

    const escalations = await prisma.serviceTemplateEscalation.findMany({
      where: { serviceTemplateId: id },
      include: {
        user: { select: { id: true, name: true, role: true, email: true } },
      },
      orderBy: { priority: "asc" },
    });

    return NextResponse.json(escalations);
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const { id } = await params;
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: "معرف المستخدم مطلوب" }, { status: 400 });
    }

    // Check template exists
    const template = await prisma.serviceTemplate.findUnique({ where: { id } });
    if (!template) {
      return NextResponse.json({ error: "قالب الخدمة غير موجود" }, { status: 404 });
    }

    // Check for duplicate
    const existing = await prisma.serviceTemplateEscalation.findUnique({
      where: { serviceTemplateId_userId: { serviceTemplateId: id, userId } },
    });
    if (existing) {
      return NextResponse.json({ error: "الموظف مضاف مسبقاً في قائمة الطوارئ" }, { status: 409 });
    }

    // Get next priority number
    const last = await prisma.serviceTemplateEscalation.findFirst({
      where: { serviceTemplateId: id },
      orderBy: { priority: "desc" },
      select: { priority: true },
    });
    const nextPriority = (last?.priority ?? 0) + 1;

    const escalation = await prisma.serviceTemplateEscalation.create({
      data: { serviceTemplateId: id, userId, priority: nextPriority },
      include: { user: { select: { id: true, name: true, role: true, email: true } } },
    });

    return NextResponse.json(escalation, { status: 201 });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const { id } = await params;

    // Support userId from query params (DELETE body may be stripped)
    const queryUserId = new URL(request.url).searchParams.get("userId");
    let userId: string | null = queryUserId;
    if (!userId) {
      try {
        const body = await request.json();
        userId = body.userId || null;
      } catch { /* empty */ }
    }

    if (!userId) {
      return NextResponse.json({ error: "معرف المستخدم مطلوب" }, { status: 400 });
    }

    await prisma.serviceTemplateEscalation.delete({
      where: { serviceTemplateId_userId: { serviceTemplateId: id, userId } },
    });

    // Re-compact priorities (fill gaps)
    const remaining = await prisma.serviceTemplateEscalation.findMany({
      where: { serviceTemplateId: id },
      orderBy: { priority: "asc" },
      select: { id: true },
    });
    for (let i = 0; i < remaining.length; i++) {
      await prisma.serviceTemplateEscalation.update({
        where: { id: remaining[i].id },
        data: { priority: i + 1 },
      });
    }

    return NextResponse.json({ message: "تم إزالة موظف الطوارئ بنجاح" });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const { id } = await params;
    const { order } = await request.json();

    // order = array of userId in new priority order
    if (!Array.isArray(order) || order.length === 0) {
      return NextResponse.json({ error: "ترتيب غير صالح" }, { status: 400 });
    }

    // Use a temporary high priority to avoid unique constraint conflicts
    const base = 10000;
    for (let i = 0; i < order.length; i++) {
      await prisma.serviceTemplateEscalation.update({
        where: { serviceTemplateId_userId: { serviceTemplateId: id, userId: order[i] } },
        data: { priority: base + i + 1 },
      });
    }
    // Now set final priorities
    for (let i = 0; i < order.length; i++) {
      await prisma.serviceTemplateEscalation.update({
        where: { serviceTemplateId_userId: { serviceTemplateId: id, userId: order[i] } },
        data: { priority: i + 1 },
      });
    }

    const updated = await prisma.serviceTemplateEscalation.findMany({
      where: { serviceTemplateId: id },
      include: { user: { select: { id: true, name: true, role: true, email: true } } },
      orderBy: { priority: "asc" },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    if (!["ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const stage = searchParams.get("stage");
    const departmentId = searchParams.get("departmentId");
    const assigneeId = searchParams.get("assigneeId");

    const where: Record<string, unknown> = {};
    if (type) where.type = type;
    if (stage) where.stage = stage;
    if (departmentId) where.departmentId = departmentId;
    if (assigneeId) where.assigneeId = assigneeId;

    const opportunities = await prisma.opportunity.findMany({
      where,
      include: {
        assignee: { select: { id: true, name: true } },
        client: { select: { id: true, name: true } },
        department: { select: { id: true, name: true, color: true } },
        _count: { select: { activities: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json(opportunities);
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    if (!["ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const body = await request.json();
    const {
      title, description, type, stage, value, probability,
      contactName, contactPhone, contactEmail, notes,
      expectedCloseDate, assigneeId, clientId, departmentId,
    } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: "عنوان الفرصة مطلوب" }, { status: 400 });
    }
    if (!type) {
      return NextResponse.json({ error: "نوع الفرصة مطلوب" }, { status: 400 });
    }

    const opportunity = await prisma.opportunity.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        type,
        stage: stage || "CONTACT",
        value: value ? parseFloat(value) : null,
        probability: probability ? parseInt(probability) : 0,
        contactName: contactName?.trim() || null,
        contactPhone: contactPhone?.trim() || null,
        contactEmail: contactEmail?.trim() || null,
        notes: notes?.trim() || null,
        expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : null,
        assigneeId: assigneeId || null,
        clientId: clientId || null,
        departmentId: departmentId || null,
      },
    });

    // Log activity
    await prisma.opportunityActivity.create({
      data: {
        opportunityId: opportunity.id,
        userId: session.user.id,
        userName: session.user.name || "",
        action: "CREATE",
        details: `تم إنشاء الفرصة`,
      },
    });

    return NextResponse.json(opportunity, { status: 201 });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

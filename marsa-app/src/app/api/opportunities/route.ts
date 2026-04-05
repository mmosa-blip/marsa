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

    if (!contactName?.trim() && !title?.trim()) {
      return NextResponse.json({ error: "اسم العميل المحتمل مطلوب" }, { status: 400 });
    }
    if (!contactPhone?.trim()) {
      return NextResponse.json({ error: "رقم الجوال مطلوب" }, { status: 400 });
    }
    if (!departmentId) {
      return NextResponse.json({ error: "القسم مطلوب" }, { status: 400 });
    }

    const parsedValue = value != null && value !== "" && value !== undefined ? parseFloat(String(value)) : null;
    const parsedProb = probability != null && probability !== "" && probability !== undefined ? parseInt(String(probability)) : 0;

    const opportunity = await prisma.opportunity.create({
      data: {
        title: (title?.trim?.() || contactName?.trim?.()) ?? "فرصة جديدة",
        description: description?.trim?.() || null,
        type: type || "SERVICES",
        stage: stage || "CONTACT",
        value: parsedValue && !isNaN(parsedValue) ? parsedValue : null,
        probability: parsedProb && !isNaN(parsedProb) ? parsedProb : 0,
        contactName: contactName?.trim?.() || null,
        contactPhone: contactPhone?.trim?.() || null,
        contactEmail: contactEmail?.trim?.() || null,
        notes: notes?.trim?.() || null,
        expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : null,
        assigneeId: assigneeId || null,
        clientId: clientId || null,
        departmentId: departmentId,
      },
    });

    // Log activity
    await prisma.opportunityActivity.create({
      data: {
        opportunityId: opportunity.id,
        userId: session.user.id,
        userName: session.user.name || "",
        action: "CREATE",
        details: `تم إنشاء الفرصة: ${opportunity.title}`,
      },
    });

    return NextResponse.json(opportunity, { status: 201 });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

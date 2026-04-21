import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    // All staff can view opportunities (not just admin/manager). Gate
    // CLIENT out explicitly — they don't belong in the CRM funnel view.
    if (session.user.role === "CLIENT") {
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
    if (error instanceof Response) return error;
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireRole(["ADMIN", "MANAGER"]);

    const body = await request.json();
    const {
      contactName, contactPhone, departmentId, value, assigneeId,
      probability, marketerName, notes, stage, clientId,
    } = body;

    if (!contactName?.trim()) {
      return NextResponse.json({ error: "اسم العميل المحتمل مطلوب" }, { status: 400 });
    }
    if (!contactPhone?.trim()) {
      return NextResponse.json({ error: "رقم الجوال مطلوب" }, { status: 400 });
    }
    if (!departmentId) {
      return NextResponse.json({ error: "القسم مطلوب" }, { status: 400 });
    }
    if (!value && value !== 0) {
      return NextResponse.json({ error: "القيمة المتوقعة مطلوبة" }, { status: 400 });
    }
    if (!assigneeId) {
      return NextResponse.json({ error: "المسؤول مطلوب" }, { status: 400 });
    }
    if (probability == null || probability === "") {
      return NextResponse.json({ error: "احتمالية الإغلاق مطلوبة" }, { status: 400 });
    }
    if (!marketerName?.trim()) {
      return NextResponse.json({ error: "اسم المسوق مطلوب" }, { status: 400 });
    }

    const parsedValue = parseFloat(String(value));
    const parsedProb = parseInt(String(probability));

    const opportunity = await prisma.opportunity.create({
      data: {
        title: contactName.trim(),
        type: "SERVICES",
        stage: stage || "CONTACT",
        value: !isNaN(parsedValue) ? parsedValue : 0,
        probability: !isNaN(parsedProb) ? parsedProb : 0,
        contactName: contactName.trim(),
        contactPhone: contactPhone.trim(),
        marketerName: marketerName.trim(),
        notes: notes?.trim?.() || null,
        assigneeId,
        clientId: clientId || null,
        departmentId,
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
    if (error instanceof Response) return error;
    console.error("Opportunity CREATE error:", error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `خطأ في إنشاء الفرصة: ${msg}` }, { status: 500 });
  }
}

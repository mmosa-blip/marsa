import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/api-auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();

    const { id } = await params;

    const opportunity = await prisma.opportunity.findUnique({
      where: { id },
      include: {
        assignee: { select: { id: true, name: true, phone: true } },
        client: { select: { id: true, name: true, phone: true } },
        department: { select: { id: true, name: true, color: true } },
        activities: { orderBy: { createdAt: "desc" }, take: 50 },
      },
    });

    if (!opportunity) {
      return NextResponse.json({ error: "الفرصة غير موجودة" }, { status: 404 });
    }

    return NextResponse.json(opportunity);
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRole(["ADMIN", "MANAGER"]);

    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.opportunity.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "الفرصة غير موجودة" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (body.title !== undefined) data.title = body.title.trim();
    if (body.description !== undefined) data.description = body.description?.trim() || null;
    if (body.type !== undefined) data.type = body.type;
    if (body.stage !== undefined) data.stage = body.stage;
    if (body.value !== undefined) data.value = body.value ? parseFloat(body.value) : null;
    if (body.probability !== undefined) data.probability = parseInt(body.probability);
    if (body.contactName !== undefined) data.contactName = body.contactName?.trim() || null;
    if (body.contactPhone !== undefined) data.contactPhone = body.contactPhone?.trim() || null;
    if (body.contactEmail !== undefined) data.contactEmail = body.contactEmail?.trim() || null;
    if (body.notes !== undefined) data.notes = body.notes?.trim() || null;
    if (body.expectedCloseDate !== undefined) data.expectedCloseDate = body.expectedCloseDate ? new Date(body.expectedCloseDate) : null;
    if (body.assigneeId !== undefined) data.assigneeId = body.assigneeId || null;
    if (body.clientId !== undefined) data.clientId = body.clientId || null;
    if (body.departmentId !== undefined) data.departmentId = body.departmentId || null;

    // Track stage changes
    if (body.stage && body.stage !== existing.stage) {
      if (body.stage === "CLOSED_WON") data.closedAt = new Date();
      if (body.stage === "CLOSED_LOST") data.closedAt = new Date();
    }

    const updated = await prisma.opportunity.update({ where: { id }, data });

    // Log stage change
    if (body.stage && body.stage !== existing.stage) {
      const stageLabels: Record<string, string> = {
        CONTACT: "تواصل", INTEREST: "اهتمام", NEGOTIATION: "تفاوض",
        CLOSED_WON: "فوز", CLOSED_LOST: "خسارة",
      };
      await prisma.opportunityActivity.create({
        data: {
          opportunityId: id,
          userId: session.user.id,
          userName: session.user.name || "",
          action: "STAGE_CHANGE",
          details: `تم نقل الفرصة من "${stageLabels[existing.stage]}" إلى "${stageLabels[body.stage]}"`,
        },
      });
    }

    // Log note addition
    if (body.activityNote) {
      await prisma.opportunityActivity.create({
        data: {
          opportunityId: id,
          userId: session.user.id,
          userName: session.user.name || "",
          action: "NOTE",
          details: body.activityNote,
        },
      });
    }

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["ADMIN"]);

    const { id } = await params;
    await prisma.opportunity.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

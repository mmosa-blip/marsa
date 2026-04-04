import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.serviceRequest.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });

    // العميل يستطيع فقط إلغاء طلبه أو إرسال رد
    if (session.user.role === "CLIENT") {
      if (existing.clientId !== session.user.id) {
        return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
      }
      if (body.status && body.status !== "CANCELLED") {
        return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
      }
    } else if (!["ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const updated = await prisma.serviceRequest.update({
      where: { id },
      data: {
        status: body.status || undefined,
        adminNotes: body.adminNotes !== undefined ? body.adminNotes : undefined,
        assignedToId: body.assignedToId !== undefined ? body.assignedToId : undefined,
        startDate: body.startDate ? new Date(body.startDate) : undefined,
        endDate: body.endDate ? new Date(body.endDate) : undefined,
        totalPrice: body.totalPrice ? parseFloat(body.totalPrice) : undefined,
        workflowType: body.workflowType || undefined,
        clientReply: body.clientReply !== undefined ? body.clientReply : undefined,
        projectId: body.projectId !== undefined ? body.projectId : undefined,
      },
      include: {
        client: { select: { id: true, name: true, email: true } },
        assignedTo: { select: { id: true, name: true } },
        items: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

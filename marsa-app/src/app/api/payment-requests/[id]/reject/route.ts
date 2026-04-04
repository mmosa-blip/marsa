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
    if (!session) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const role = session.user.role;

    if (!body.notes) {
      return NextResponse.json({ error: "يجب كتابة سبب الرفض" }, { status: 400 });
    }

    const paymentRequest = await prisma.paymentRequest.findUnique({
      where: { id },
      include: {
        provider: { select: { supervisorId: true } },
      },
    });

    if (!paymentRequest) {
      return NextResponse.json({ error: "طلب الدفع غير موجود" }, { status: 404 });
    }

    if (paymentRequest.status === "REJECTED" || paymentRequest.status === "PAID") {
      return NextResponse.json({ error: "لا يمكن رفض هذا الطلب" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {
      status: "REJECTED",
    };

    // تحديد المرحلة الحالية وتسجيل ملاحظات الرفض
    switch (paymentRequest.status) {
      case "PENDING_SUPERVISOR": {
        const isSupervisor = paymentRequest.provider.supervisorId === session.user.id;
        if (!["ADMIN", "MANAGER"].includes(role) && role !== "EXECUTOR" && !isSupervisor) {
          return NextResponse.json({ error: "غير مصرح لك برفض هذا الطلب" }, { status: 403 });
        }
        updateData.supervisorApproval = false;
        updateData.supervisorApprovedAt = new Date();
        updateData.supervisorNotes = body.notes;
        break;
      }
      case "PENDING_FINANCE": {
        if (!["ADMIN", "MANAGER", "FINANCE_MANAGER"].includes(role)) {
          return NextResponse.json({ error: "غير مصرح لك برفض هذا الطلب" }, { status: 403 });
        }
        updateData.financeApproval = false;
        updateData.financeApprovedAt = new Date();
        updateData.financeNotes = body.notes;
        break;
      }
      case "PENDING_TREASURY": {
        if (!["ADMIN", "MANAGER", "TREASURY_MANAGER"].includes(role)) {
          return NextResponse.json({ error: "غير مصرح لك برفض هذا الطلب" }, { status: 403 });
        }
        updateData.treasuryApproval = false;
        updateData.treasuryApprovedAt = new Date();
        updateData.treasuryNotes = body.notes;
        break;
      }
      default:
        return NextResponse.json({ error: "حالة الطلب غير صالحة للرفض" }, { status: 400 });
    }

    const updated = await prisma.paymentRequest.update({
      where: { id },
      data: updateData,
      include: {
        provider: { select: { name: true } },
        taskCost: {
          include: {
            task: { select: { title: true } },
          },
        },
        requestedBy: { select: { name: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ في رفض طلب الدفع" }, { status: 500 });
  }
}

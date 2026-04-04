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
      return NextResponse.json({ error: "لا يمكن الموافقة على هذا الطلب" }, { status: 400 });
    }

    const isSupervisor = paymentRequest.provider.supervisorId === session.user.id;
    const updateData: Record<string, unknown> = {};

    // مرحلة موافقة المشرف
    if (
      (role === "EXECUTOR" || ((role === "ADMIN" || role === "MANAGER") && isSupervisor)) &&
      paymentRequest.status === "PENDING_SUPERVISOR"
    ) {
      updateData.supervisorApproval = true;
      updateData.supervisorApprovedAt = new Date();
      updateData.supervisorNotes = body.notes || null;
      updateData.status = "PENDING_FINANCE";
    }
    // مرحلة موافقة المالية
    else if (role === "FINANCE_MANAGER" && paymentRequest.status === "PENDING_FINANCE") {
      updateData.financeApproval = true;
      updateData.financeApprovedAt = new Date();
      updateData.financeNotes = body.notes || null;
      updateData.status = "PENDING_TREASURY";
    }
    // مرحلة موافقة الخزينة
    else if (role === "TREASURY_MANAGER" && paymentRequest.status === "PENDING_TREASURY") {
      updateData.treasuryApproval = true;
      updateData.treasuryApprovedAt = new Date();
      updateData.treasuryNotes = body.notes || null;
      updateData.paymentMethod = body.paymentMethod || null;
      updateData.paymentReference = body.paymentReference || null;
      updateData.paidAt = new Date();
      updateData.status = "PAID";
    }
    // ADMIN/MANAGER يمكنهم الموافقة على أي مرحلة
    else if (["ADMIN", "MANAGER"].includes(role)) {
      if (paymentRequest.status === "PENDING_SUPERVISOR") {
        updateData.supervisorApproval = true;
        updateData.supervisorApprovedAt = new Date();
        updateData.supervisorNotes = body.notes || null;
        updateData.status = "PENDING_FINANCE";
      } else if (paymentRequest.status === "PENDING_FINANCE") {
        updateData.financeApproval = true;
        updateData.financeApprovedAt = new Date();
        updateData.financeNotes = body.notes || null;
        updateData.status = "PENDING_TREASURY";
      } else if (paymentRequest.status === "PENDING_TREASURY") {
        updateData.treasuryApproval = true;
        updateData.treasuryApprovedAt = new Date();
        updateData.treasuryNotes = body.notes || null;
        updateData.paymentMethod = body.paymentMethod || null;
        updateData.paymentReference = body.paymentReference || null;
        updateData.paidAt = new Date();
        updateData.status = "PAID";
      } else {
        return NextResponse.json({ error: "لا يمكن الموافقة على هذا الطلب في حالته الحالية" }, { status: 400 });
      }
    } else {
      return NextResponse.json({ error: "غير مصرح لك بالموافقة على هذا الطلب" }, { status: 403 });
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
    return NextResponse.json({ error: "حدث خطأ في الموافقة على طلب الدفع" }, { status: 500 });
  }
}

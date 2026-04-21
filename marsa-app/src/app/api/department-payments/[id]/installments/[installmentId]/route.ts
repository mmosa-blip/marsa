import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";

// PATCH — mark installment as paid
export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; installmentId: string }> }
) {
  try {
    await requireRole(["ADMIN", "MANAGER"]);

    const { id, installmentId } = await params;

    const installment = await prisma.deptPaymentInstallment.update({
      where: { id: installmentId },
      data: { status: "PAID", paidDate: new Date() },
    });

    // Recalculate parent payment status
    const allInstallments = await prisma.deptPaymentInstallment.findMany({
      where: { paymentId: id },
    });

    const paidTotal = allInstallments
      .filter((i) => i.status === "PAID")
      .reduce((sum, i) => sum + i.amount, 0);

    const payment = await prisma.departmentPayment.findUnique({ where: { id } });
    if (payment) {
      const allPaid = allInstallments.every((i) => i.status === "PAID");
      await prisma.departmentPayment.update({
        where: { id },
        data: {
          paidAmount: paidTotal,
          status: allPaid ? "PAID" : paidTotal > 0 ? "PARTIAL" : "PENDING",
        },
      });
    }

    return NextResponse.json(installment);
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

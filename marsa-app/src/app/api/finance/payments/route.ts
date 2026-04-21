import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";

export async function GET() {
  try {
    await requireRole(["ADMIN", "MANAGER"]);
    const payments = await prisma.payment.findMany({
      include: {
        invoice: { select: { invoiceNumber: true, title: true, company: { select: { name: true } } } },
      },
      orderBy: { paymentDate: "desc" },
    });
    return NextResponse.json(payments);
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

    const { id } = await params;

    const transaction = await prisma.cashierTransaction.findUnique({
      where: { id },
      include: {
        client: { select: { name: true, phone: true, email: true } },
        cashier: { select: { name: true } },
        invoice: {
          include: {
            items: true,
            company: { select: { name: true } },
          },
        },
      },
    });

    if (!transaction) {
      return NextResponse.json({ error: "العملية غير موجودة" }, { status: 404 });
    }

    return NextResponse.json(transaction);
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

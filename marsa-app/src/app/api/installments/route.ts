import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const contractId = searchParams.get("contractId");

    if (!contractId) {
      return NextResponse.json({ error: "يجب تحديد العقد (contractId)" }, { status: 400 });
    }

    const role = session.user.role;
    const userId = session.user.id;
    const isAdmin = ["ADMIN", "MANAGER"].includes(role);

    // Verify contract exists and user has access
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      select: { id: true, clientId: true },
    });

    if (!contract) {
      return NextResponse.json({ error: "العقد غير موجود" }, { status: 404 });
    }

    if (!isAdmin && contract.clientId !== userId) {
      return NextResponse.json({ error: "غير مصرح بالوصول لدفعات هذا العقد" }, { status: 403 });
    }

    const installments = await prisma.contractPaymentInstallment.findMany({
      where: { contractId },
      include: {
        linkedTask: { select: { id: true, title: true, status: true } },
        _count: { select: { tickets: true } },
        contract: {
          select: {
            template: { select: { title: true } },
          },
        },
      },
      orderBy: { order: "asc" },
    });

    return NextResponse.json(installments);
  } catch (error) {
    console.error("Error fetching installments:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

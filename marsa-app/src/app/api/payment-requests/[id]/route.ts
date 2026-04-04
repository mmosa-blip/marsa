import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const { id } = await params;

    const paymentRequest = await prisma.paymentRequest.findUnique({
      where: { id },
      include: {
        provider: {
          select: {
            id: true,
            name: true,
            specialization: true,
            bankName: true,
            bankIban: true,
            supervisorId: true,
          },
        },
        taskCost: {
          include: {
            task: {
              select: {
                id: true,
                title: true,
                status: true,
                service: { select: { id: true, name: true } },
                project: { select: { id: true, name: true } },
              },
            },
          },
        },
        requestedBy: { select: { id: true, name: true } },
      },
    });

    if (!paymentRequest) {
      return NextResponse.json({ error: "طلب الدفع غير موجود" }, { status: 404 });
    }

    // التحقق من صلاحية الوصول
    const role = session.user.role;
    if (role === "EXTERNAL_PROVIDER" && paymentRequest.providerId !== session.user.id) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }
    if (role === "EXECUTOR" && paymentRequest.provider.supervisorId !== session.user.id) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    return NextResponse.json(paymentRequest);
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ في جلب طلب الدفع" }, { status: 500 });
  }
}

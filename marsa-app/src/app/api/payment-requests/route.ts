import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const providerId = searchParams.get("providerId");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    const where: Record<string, unknown> = {};

    // فلترة حسب الدور
    const role = session.user.role;
    if (role === "EXTERNAL_PROVIDER") {
      where.providerId = session.user.id;
    } else if (role === "EXECUTOR") {
      where.provider = { supervisorId: session.user.id };
    } else if (role === "FINANCE_MANAGER") {
      where.status = { in: ["PENDING_FINANCE", "PENDING_TREASURY", "APPROVED", "PAID", "REJECTED"] };
    } else if (role === "TREASURY_MANAGER") {
      where.status = { in: ["PENDING_TREASURY", "APPROVED", "PAID", "REJECTED"] };
    } else if (!["ADMIN", "MANAGER"].includes(role)) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    // فلترة إضافية من query params
    if (status) {
      // إذا كان هناك فلتر دور بالفعل، نجمع الشرطين
      if (where.status && typeof where.status === "object" && "in" in where.status) {
        const allowedStatuses = (where.status as { in: string[] }).in;
        if (allowedStatuses.includes(status)) {
          where.status = status;
        }
      } else {
        where.status = status;
      }
    }
    if (providerId) where.providerId = providerId;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) (where.createdAt as Record<string, unknown>).gte = new Date(dateFrom);
      if (dateTo) (where.createdAt as Record<string, unknown>).lte = new Date(dateTo);
    }

    const paymentRequests = await prisma.paymentRequest.findMany({
      where,
      include: {
        provider: {
          select: {
            name: true,
            specialization: true,
            bankName: true,
            bankIban: true,
          },
        },
        taskCost: {
          include: {
            task: {
              select: {
                title: true,
                service: { select: { name: true } },
              },
            },
          },
        },
        requestedBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(paymentRequests);
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ في جلب طلبات الدفع" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "MANAGER", "EXECUTOR"].includes(session.user.role)) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const body = await request.json();
    const { taskId, providerId, amount, notes } = body;

    if (!taskId || !providerId) {
      return NextResponse.json({ error: "يجب تحديد المهمة والمزود" }, { status: 400 });
    }

    // التحقق من وجود TaskCost أو إنشاء واحد
    let taskCost = await prisma.taskCost.findUnique({
      where: { taskId_providerId: { taskId, providerId } },
    });

    if (!taskCost) {
      const provider = await prisma.user.findUnique({
        where: { id: providerId },
        select: { costPerTask: true },
      });

      const costAmount = amount || provider?.costPerTask || 0;
      if (!costAmount) {
        return NextResponse.json({ error: "يجب تحديد المبلغ" }, { status: 400 });
      }

      taskCost = await prisma.taskCost.create({
        data: {
          taskId,
          providerId,
          amount: costAmount,
          notes,
        },
      });
    }

    // التحقق من عدم وجود طلب دفع مسبق لنفس TaskCost
    const existingRequest = await prisma.paymentRequest.findUnique({
      where: { taskCostId: taskCost.id },
    });
    if (existingRequest) {
      return NextResponse.json({ error: "يوجد طلب دفع مسبق لهذه التكلفة" }, { status: 400 });
    }

    // توليد رقم طلب الدفع
    const lastRequest = await prisma.paymentRequest.findFirst({
      orderBy: { createdAt: "desc" },
      select: { requestNumber: true },
    });
    let nextNum = 1;
    if (lastRequest) {
      const match = lastRequest.requestNumber.match(/PAY-REQ-(\d+)/);
      if (match) nextNum = parseInt(match[1]) + 1;
    }
    const requestNumber = `PAY-REQ-${String(nextNum).padStart(4, "0")}`;

    const paymentRequest = await prisma.paymentRequest.create({
      data: {
        requestNumber,
        amount: amount || taskCost.amount,
        status: "PENDING_SUPERVISOR",
        notes,
        taskCostId: taskCost.id,
        providerId,
        requestedById: session.user.id,
      },
      include: {
        provider: { select: { name: true } },
        taskCost: {
          include: {
            task: { select: { title: true } },
          },
        },
      },
    });

    return NextResponse.json(paymentRequest, { status: 201 });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ في إنشاء طلب الدفع" }, { status: 500 });
  }
}

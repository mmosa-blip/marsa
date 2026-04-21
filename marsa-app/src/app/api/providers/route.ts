import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import bcrypt from "bcryptjs";

export async function GET() {
  try {
    await requireRole(["ADMIN", "MANAGER"]);

    const providers = await prisma.user.findMany({
      where: { role: "EXTERNAL_PROVIDER" },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        specialization: true,
        costPerTask: true,
        bankName: true,
        bankIban: true,
        isExternal: true,
        createdAt: true,
        supervisorId: true,
        supervisor: {
          select: { id: true, name: true },
        },
        _count: {
          select: { assignedTasks: true },
        },
        providerPaymentRequests: {
          where: {
            status: {
              notIn: ["PAID", "REJECTED"],
            },
          },
          select: {
            amount: true,
          },
        },
      },
    });

    const result = providers.map((provider) => {
      const pendingPayments = provider.providerPaymentRequests.reduce(
        (sum, req) => sum + req.amount,
        0
      );
      const { providerPaymentRequests, _count, ...rest } = provider;
      return {
        ...rest,
        assignedTasksCount: _count.assignedTasks,
        pendingPayments,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error fetching providers:", error);
    return NextResponse.json({ error: "حدث خطأ في جلب البيانات" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireRole(["ADMIN", "MANAGER"]);

    const body = await request.json();
    const {
      name,
      email,
      password,
      phone,
      specialization,
      supervisorId,
      costPerTask,
      bankName,
      bankIban,
    } = body;

    if (!name || !phone || !password) {
      return NextResponse.json(
        { error: "الاسم ورقم الجوال وكلمة المرور مطلوبة" },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { phone },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "رقم الجوال مسجل مسبقاً" },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const provider = await prisma.user.create({
      data: {
        name,
        phone,
        email: email || null,
        password: hashedPassword,
        specialization,
        supervisorId,
        costPerTask,
        bankName,
        bankIban,
        role: "EXTERNAL_PROVIDER",
        isExternal: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        specialization: true,
        costPerTask: true,
        bankName: true,
        bankIban: true,
        isExternal: true,
        role: true,
        supervisorId: true,
        supervisor: {
          select: { id: true, name: true },
        },
        createdAt: true,
      },
    });

    return NextResponse.json(provider, { status: 201 });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error creating provider:", error);
    return NextResponse.json(
      { error: "حدث خطأ في إنشاء مزود الخدمة" },
      { status: 500 }
    );
  }
}

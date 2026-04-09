import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { passwordSchema, normalizePhone, isValidPhone } from "@/lib/validations";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { password, name, phone, email, role } = body;

    if (!name) {
      return NextResponse.json({ error: "الاسم مطلوب" }, { status: 400 });
    }

    if (!phone) {
      return NextResponse.json({ error: "رقم الجوال مطلوب" }, { status: 400 });
    }

    const normalizedPhone = normalizePhone(phone);
    if (!isValidPhone(normalizedPhone)) {
      return NextResponse.json(
        { error: "رقم الجوال غير صالح — أدخل رقماً بصيغة دولية يبدأ بـ + ورمز الدولة" },
        { status: 400 }
      );
    }

    const passwordResult = passwordSchema.safeParse(password);
    if (!passwordResult.success) {
      const errors = passwordResult.error.issues.map((e: { message: string }) => e.message).join(", ");
      return NextResponse.json({ error: errors }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({
      where: { phone: normalizedPhone },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "رقم الجوال مسجل مسبقاً" },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        phone: normalizedPhone,
        password: hashedPassword,
        name,
        email: email?.trim() || null,
        role: role || "CLIENT",
      },
      select: {
        id: true,
        phone: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      { message: "تم إنشاء الحساب بنجاح", user },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "حدث خطأ في إنشاء الحساب" },
      { status: 500 }
    );
  }
}

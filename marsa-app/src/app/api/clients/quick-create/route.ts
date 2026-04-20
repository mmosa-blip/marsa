import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizePhone, isValidPhone } from "@/lib/validations";
import { requireRole } from "@/lib/api-auth";
import bcrypt from "bcryptjs";
import crypto from "crypto";

// Server-generated random password. The plaintext is returned to the
// caller exactly once so the cashier can hand it to the client; it is
// never persisted in plaintext. Users get mustChangePassword=true so
// login forces them to pick their own password on first sign-in.
function generateRandomPassword(): string {
  return crypto.randomBytes(9).toString("base64").replace(/[+/=]/g, "").slice(0, 12);
}

// POST /api/clients/quick-create
// Admin/Manager only. Creates a CLIENT account with a server-generated
// random password and returns the plaintext once. Replaces the old flow
// where the cashier page posted `password: "12345678"` to /api/auth/register.
export async function POST(request: Request) {
  try {
    await requireRole(["ADMIN", "MANAGER"]);

    const body = await request.json();
    const { name, phone, email, companyName } = body as {
      name?: string;
      phone?: string | null;
      email?: string | null;
      companyName?: string | null;
    };

    if (!name || !name.trim()) {
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

    const existing = await prisma.user.findUnique({ where: { phone: normalizedPhone } });
    if (existing) {
      return NextResponse.json({ error: "رقم الجوال مسجل مسبقاً" }, { status: 409 });
    }

    const plainPassword = generateRandomPassword();
    const hashedPassword = await bcrypt.hash(plainPassword, 12);

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        phone: normalizedPhone,
        email: email?.trim() || null,
        password: hashedPassword,
        role: "CLIENT",
        mustChangePassword: true,
      },
      select: { id: true, name: true, phone: true, email: true },
    });

    // Attach company if the cashier entered one — same pattern that the
    // page used to do with a second request to /api/hr/companies.
    if (companyName && companyName.trim()) {
      await prisma.company.create({
        data: {
          name: companyName.trim(),
          ownerId: user.id,
        },
      });
    }

    return NextResponse.json({
      user,
      // One-time plaintext password. The UI should display it, let the
      // cashier copy/hand it to the client, then clear it from state.
      password: plainPassword,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("quick-create error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

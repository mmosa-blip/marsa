import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// محاكاة OTP - كود ثابت 123456
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    await params;
    const body = await request.json();
    const { otp } = body;

    if (otp === "123456") {
      return NextResponse.json({ verified: true, message: "تم التحقق بنجاح" });
    }

    return NextResponse.json({ verified: false, message: "رمز التحقق غير صحيح" }, { status: 400 });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

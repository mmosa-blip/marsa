import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";

// محاكاة OTP - كود ثابت 123456
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["ADMIN", "MANAGER"]);

    await params;
    const body = await request.json();
    const { otp } = body;

    if (otp === "123456") {
      return NextResponse.json({ verified: true, message: "تم التحقق بنجاح" });
    }

    return NextResponse.json({ verified: false, message: "رمز التحقق غير صحيح" }, { status: 400 });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

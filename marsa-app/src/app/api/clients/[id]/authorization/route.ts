import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    const { authorizationType } = body;

    if (!["FULL", "PER_SERVICE", "NONE"].includes(authorizationType)) {
      return NextResponse.json({ error: "نوع التفويض غير صالح" }, { status: 400 });
    }

    // التحقق من أن المستخدم هو العميل نفسه أو أدمن
    if (session.user.id !== id && !["ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        authorizationType,
        authorizationGrantedAt: authorizationType !== "NONE" ? new Date() : null,
      },
      select: { id: true, authorizationType: true, authorizationGrantedAt: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

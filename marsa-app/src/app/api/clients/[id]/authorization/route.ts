import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET — view authorization status (client self or admin/manager)
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

    const { id } = await params;

    if (session.user.id !== id && !["ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        authorizationType: true,
        authorizationGrantedAt: true,
        authorizationSignature: true,
      },
    });

    if (!user) return NextResponse.json({ error: "المستخدم غير موجود" }, { status: 404 });

    return NextResponse.json(user);
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

// POST — only the client themselves can create/update authorization
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

    const { id } = await params;

    // Only the client themselves can set their authorization
    if (session.user.id !== id) {
      return NextResponse.json({ error: "التفويض يتم فقط من قبل العميل نفسه" }, { status: 403 });
    }

    const body = await request.json();
    const { authorizationType, signature } = body;

    if (!["FULL", "PER_SERVICE", "NONE"].includes(authorizationType)) {
      return NextResponse.json({ error: "نوع التفويض غير صالح" }, { status: 400 });
    }

    // Require signature when granting authorization
    if (authorizationType !== "NONE" && !signature) {
      return NextResponse.json({ error: "التوقيع مطلوب لإتمام التفويض" }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        authorizationType,
        authorizationGrantedAt: authorizationType !== "NONE" ? new Date() : null,
        authorizationSignature: authorizationType !== "NONE" ? signature : null,
      },
      select: {
        id: true,
        authorizationType: true,
        authorizationGrantedAt: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

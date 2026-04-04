import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { signatureImage: true, stampImage: true },
    });

    return NextResponse.json({
      signatureImage: user?.signatureImage || null,
      stampImage: user?.stampImage || null,
    });
  } catch (error) {
    console.error("Error fetching signature:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const { signatureImage, stampImage } = await request.json();

    const data: Record<string, string | null> = {};
    if (signatureImage !== undefined) data.signatureImage = signatureImage;
    if (stampImage !== undefined) data.stampImage = stampImage;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "لا توجد بيانات للتحديث" }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data,
      select: { signatureImage: true, stampImage: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error saving signature:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

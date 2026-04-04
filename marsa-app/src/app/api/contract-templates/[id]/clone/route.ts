import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !["ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const { id } = await params;

    const original = await prisma.contractTemplate.findUnique({
      where: { id },
    });

    if (!original) {
      return NextResponse.json({ error: "القالب غير موجود" }, { status: 404 });
    }

    return NextResponse.json({
      template: {
        title: original.title,
        content: original.content,
        description: original.description,
        marginTop: original.marginTop,
        marginBottom: original.marginBottom,
        marginLeft: original.marginLeft,
        marginRight: original.marginRight,
        fontSize: original.fontSize,
        textAlign: original.textAlign,
        letterheadImage: original.letterheadImage,
      },
    });
  } catch (error) {
    console.error("Error cloning contract template:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

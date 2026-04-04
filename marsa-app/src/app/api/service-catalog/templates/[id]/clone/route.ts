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

    const original = await prisma.serviceTemplate.findUnique({
      where: { id },
      include: {
        category: true,
        taskTemplates: { orderBy: { sortOrder: "asc" } },
      },
    });

    if (!original) {
      return NextResponse.json({ error: "قالب الخدمة غير موجود" }, { status: 404 });
    }

    return NextResponse.json({ template: original });
  } catch (error) {
    console.error("Error cloning service template:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

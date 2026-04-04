import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    await params; // consume params
    const { holdId, note } = await request.json();
    if (!holdId || !note?.trim()) {
      return NextResponse.json({ error: "holdId والملاحظة مطلوبان" }, { status: 400 });
    }

    const update = await prisma.governmentUpdate.create({
      data: {
        holdId,
        note: note.trim(),
        addedById: session.user.id,
      },
      include: { addedBy: { select: { name: true } } },
    });

    return NextResponse.json(update);
  } catch (error) {
    console.error("Error adding government update:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

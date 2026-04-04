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
    const { linkId, note } = await request.json();
    if (!linkId) {
      return NextResponse.json({ error: "linkId مطلوب" }, { status: 400 });
    }

    const reminder = await prisma.providerReminder.create({
      data: {
        linkId,
        remindedById: session.user.id,
        note: note || null,
      },
    });

    const count = await prisma.providerReminder.count({ where: { linkId } });
    return NextResponse.json({ reminder, totalReminders: count });
  } catch (error) {
    console.error("Error sending provider reminder:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

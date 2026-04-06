import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST — Executor accepts a task assigned to them
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

    const { id } = await params;
    const task = await prisma.task.findUnique({
      where: { id },
      select: { id: true, assigneeId: true, acceptedAt: true, title: true },
    });

    if (!task) return NextResponse.json({ error: "المهمة غير موجودة" }, { status: 404 });

    if (task.assigneeId !== session.user.id) {
      return NextResponse.json(
        { error: "يمكن فقط للمنفذ المعيّن قبول المهمة" },
        { status: 403 }
      );
    }

    if (task.acceptedAt) {
      return NextResponse.json({ error: "المهمة مقبولة بالفعل" }, { status: 400 });
    }

    const updated = await prisma.task.update({
      where: { id },
      data: { acceptedAt: new Date() },
      select: { id: true, acceptedAt: true },
    });

    return NextResponse.json({ success: true, acceptedAt: updated.acceptedAt });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

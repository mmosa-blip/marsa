import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    if (body.dueDate) body.dueDate = new Date(body.dueDate);
    if (body.reminderDays) body.reminderDays = parseInt(body.reminderDays);
    if (body.recurringMonths) body.recurringMonths = parseInt(body.recurringMonths);

    const reminder = await prisma.reminder.update({
      where: { id },
      data: body,
      include: {
        company: { select: { name: true } },
        employee: { select: { name: true } },
      },
    });

    return NextResponse.json(reminder);
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const { id } = await params;
    await prisma.reminder.delete({ where: { id } });

    return NextResponse.json({ message: "تم الحذف" });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

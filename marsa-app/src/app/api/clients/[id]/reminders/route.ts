import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }
    const { id } = await params;

    const reminders = await prisma.reminder.findMany({
      where: { clientId: id },
      include: {
        company: { select: { name: true } },
        createdBy: { select: { name: true } },
      },
      orderBy: { dueDate: "asc" },
    });

    // تحديث حالة المتأخرة
    const now = new Date();
    const updated = reminders.map((r) => {
      if (r.status === "PENDING" && new Date(r.dueDate) < now) {
        return { ...r, status: "OVERDUE" };
      }
      return r;
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

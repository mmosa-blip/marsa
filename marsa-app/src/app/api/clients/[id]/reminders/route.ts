import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["ADMIN", "MANAGER"]);
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
    if (error instanceof Response) return error;
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

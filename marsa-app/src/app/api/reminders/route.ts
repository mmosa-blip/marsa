import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";

export async function GET(request: Request) {
  try {
    await requireRole(["ADMIN", "MANAGER"]);

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const status = searchParams.get("status");
    const priority = searchParams.get("priority");

    const where: Record<string, unknown> = {};
    if (type) where.type = type;
    if (status) where.status = status;
    if (priority) where.priority = priority;

    const reminders = await prisma.reminder.findMany({
      where,
      include: {
        company: { select: { name: true } },
        employee: { select: { id: true, name: true } },
        createdBy: { select: { name: true } },
      },
      orderBy: { dueDate: "asc" },
    });

    // تحديث الحالة تلقائياً للمتأخرة
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

export async function POST(request: Request) {
  try {
    const session = await requireRole(["ADMIN", "MANAGER"]);

    const body = await request.json();

    if (!body.title || !body.dueDate || !body.companyId) {
      return NextResponse.json({ error: "العنوان وتاريخ الاستحقاق والشركة مطلوبة" }, { status: 400 });
    }

    const reminder = await prisma.reminder.create({
      data: {
        title: body.title,
        description: body.description || null,
        type: body.type || "CUSTOM",
        dueDate: new Date(body.dueDate),
        reminderDays: body.reminderDays ? parseInt(body.reminderDays) : 30,
        isRecurring: body.isRecurring || false,
        recurringMonths: body.recurringMonths ? parseInt(body.recurringMonths) : null,
        priority: body.priority || "MEDIUM",
        companyId: body.companyId,
        employeeId: body.employeeId || null,
        createdById: session.user.id,
      },
      include: {
        company: { select: { name: true } },
        employee: { select: { name: true } },
      },
    });

    return NextResponse.json(reminder, { status: 201 });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

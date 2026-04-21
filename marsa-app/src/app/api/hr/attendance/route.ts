import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";

export async function GET(request: Request) {
  try {
    await requireRole(["ADMIN", "MANAGER"]);
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");

    const where: Record<string, unknown> = {};
    if (date) {
      const d = new Date(date);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      where.date = { gte: d, lt: next };
    }

    const attendances = await prisma.attendance.findMany({
      where,
      include: { employee: { select: { id: true, name: true, department: true, jobTitle: true } } },
      orderBy: { date: "desc" },
    });
    return NextResponse.json(attendances);
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

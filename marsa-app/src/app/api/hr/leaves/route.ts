import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/api-auth";

export async function GET() {
  try {
    await requireRole(["ADMIN", "MANAGER"]);
    const leaves = await prisma.leaveRequest.findMany({
      include: { employee: { select: { id: true, name: true, department: true, avatar: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(leaves);
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAuth();
    const body = await request.json();
    if (!body.employeeId || !body.type || !body.startDate || !body.endDate) {
      return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
    }
    const leave = await prisma.leaveRequest.create({
      data: {
        type: body.type,
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
        reason: body.reason || null,
        employeeId: body.employeeId,
      },
      include: { employee: { select: { name: true } } },
    });
    return NextResponse.json(leave, { status: 201 });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

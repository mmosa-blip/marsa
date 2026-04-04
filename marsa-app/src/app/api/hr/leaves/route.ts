import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }
    const leaves = await prisma.leaveRequest.findMany({
      include: { employee: { select: { id: true, name: true, department: true, avatar: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(leaves);
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
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
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

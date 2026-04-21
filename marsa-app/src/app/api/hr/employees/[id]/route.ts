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
    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        company: { select: { name: true } },
        leaveRequests: { orderBy: { createdAt: "desc" }, take: 10 },
        attendances: { orderBy: { date: "desc" }, take: 30 },
      },
    });
    if (!employee) return NextResponse.json({ error: "الموظف غير موجود" }, { status: 404 });
    return NextResponse.json(employee);
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["ADMIN", "MANAGER"]);
    const { id } = await params;
    const body = await request.json();

    const dateFields = ["dateOfBirth", "hireDate", "residencyExpiry", "insuranceExpiry"];
    const numFields = ["baseSalary", "housingAllowance", "transportAllowance"];
    for (const f of dateFields) { if (body[f]) body[f] = new Date(body[f]); }
    for (const f of numFields) { if (body[f]) body[f] = parseFloat(body[f]); }

    const employee = await prisma.employee.update({ where: { id }, data: body });
    return NextResponse.json(employee);
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

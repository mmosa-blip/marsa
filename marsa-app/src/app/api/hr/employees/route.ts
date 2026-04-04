import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "MANAGER", "CLIENT"].includes(session.user.role)) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const department = searchParams.get("department");
    const status = searchParams.get("status");

    const where: Record<string, unknown> = {};

    // العميل يرى موظفي شركته فقط
    if (session.user.role === "CLIENT") {
      const userCompanies = await prisma.company.findMany({
        where: { ownerId: session.user.id },
        select: { id: true },
      });
      where.companyId = { in: userCompanies.map((c) => c.id) };
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { nationalId: { contains: search } },
        { phone: { contains: search } },
      ];
    }
    if (department) where.department = department;
    if (status) where.status = status;

    const employees = await prisma.employee.findMany({
      where,
      include: { company: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });

    // حساب التنبيهات
    const now = new Date();
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const enriched = employees.map((emp) => ({
      ...emp,
      alerts: {
        residencyExpired: emp.residencyExpiry ? new Date(emp.residencyExpiry) < now : false,
        residencyExpiringSoon: emp.residencyExpiry ? new Date(emp.residencyExpiry) >= now && new Date(emp.residencyExpiry) <= thirtyDays : false,
        insuranceExpired: emp.insuranceExpiry ? new Date(emp.insuranceExpiry) < now : false,
        insuranceExpiringSoon: emp.insuranceExpiry ? new Date(emp.insuranceExpiry) >= now && new Date(emp.insuranceExpiry) <= thirtyDays : false,
      },
    }));

    return NextResponse.json(enriched);
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "MANAGER", "CLIENT"].includes(session.user.role)) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const body = await request.json();

    if (!body.name || !body.companyId) {
      return NextResponse.json({ error: "الاسم والشركة مطلوبان" }, { status: 400 });
    }

    // العميل يضيف لشركته فقط
    if (session.user.role === "CLIENT") {
      const company = await prisma.company.findFirst({
        where: { id: body.companyId, ownerId: session.user.id },
      });
      if (!company) {
        return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
      }
    }

    const employee = await prisma.employee.create({
      data: {
        name: body.name,
        nationality: body.nationality || null,
        nationalId: body.nationalId || null,
        dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
        jobTitle: body.jobTitle || null,
        department: body.department || null,
        hireDate: body.hireDate ? new Date(body.hireDate) : null,
        baseSalary: body.baseSalary ? parseFloat(body.baseSalary) : null,
        housingAllowance: body.housingAllowance ? parseFloat(body.housingAllowance) : null,
        transportAllowance: body.transportAllowance ? parseFloat(body.transportAllowance) : null,
        phone: body.phone || null,
        email: body.email || null,
        passportNumber: body.passportNumber || null,
        residencyExpiry: body.residencyExpiry ? new Date(body.residencyExpiry) : null,
        insuranceExpiry: body.insuranceExpiry ? new Date(body.insuranceExpiry) : null,
        companyId: body.companyId,
      },
    });

    return NextResponse.json(employee, { status: 201 });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

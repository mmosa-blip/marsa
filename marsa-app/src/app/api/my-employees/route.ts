import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "غير مسجل الدخول" }, { status: 401 });
    }
    if (session.user.role !== "CLIENT") {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const userId = session.user.id;

    // Find companies owned by this client
    const companies = await prisma.company.findMany({
      where: { ownerId: userId },
      select: { id: true },
    });

    const companyIds = companies.map((c) => c.id);

    if (companyIds.length === 0) {
      return NextResponse.json([]);
    }

    const employees = await prisma.employee.findMany({
      where: { companyId: { in: companyIds } },
      include: {
        company: { select: { name: true } },
      },
      orderBy: { name: "asc" },
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
    if (!session) {
      return NextResponse.json({ error: "غير مسجل الدخول" }, { status: 401 });
    }
    if (session.user.role !== "CLIENT") {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const userId = session.user.id;
    const body = await request.json();

    if (!body.name || !body.companyId) {
      return NextResponse.json(
        { error: "اسم الموظف والشركة مطلوبان" },
        { status: 400 }
      );
    }

    // Verify the company belongs to the current user
    const company = await prisma.company.findFirst({
      where: { id: body.companyId, ownerId: userId },
    });

    if (!company) {
      return NextResponse.json(
        { error: "الشركة غير موجودة أو غير مصرح لك" },
        { status: 403 }
      );
    }

    const employee = await prisma.employee.create({
      data: {
        name: body.name,
        nationality: body.nationality || null,
        nationalId: body.nationalId || null,
        dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
        jobTitle: body.jobTitle || null,
        department: body.department || null,
        baseSalary: body.baseSalary ? parseFloat(body.baseSalary) : null,
        housingAllowance: body.housingAllowance ? parseFloat(body.housingAllowance) : null,
        transportAllowance: body.transportAllowance ? parseFloat(body.transportAllowance) : null,
        phone: body.phone || null,
        email: body.email || null,
        passportNumber: body.passportNumber || null,
        companyId: body.companyId,
        hireDate: body.hireDate ? new Date(body.hireDate) : null,
        residencyExpiry: body.residencyExpiry ? new Date(body.residencyExpiry) : null,
        insuranceExpiry: body.insuranceExpiry ? new Date(body.insuranceExpiry) : null,
      },
      include: {
        company: { select: { name: true } },
      },
    });

    return NextResponse.json(employee, { status: 201 });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

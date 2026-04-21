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

    // التحقق من التفويض
    const client = await prisma.user.findUnique({
      where: { id },
      select: { authorizationType: true, ownedCompanies: { select: { id: true } } },
    });

    if (!client) {
      return NextResponse.json({ error: "العميل غير موجود" }, { status: 404 });
    }

    if (client.authorizationType === "NONE") {
      return NextResponse.json({ error: "لا يوجد تفويض للوصول لبيانات الموظفين", requiresAuth: true }, { status: 403 });
    }

    if (client.authorizationType === "PER_SERVICE") {
      return NextResponse.json({ error: "يتطلب تحقق OTP", requiresOtp: true }, { status: 403 });
    }

    // تفويض شامل - جلب الموظفين
    const companyIds = client.ownedCompanies.map((c) => c.id);
    if (companyIds.length === 0) {
      return NextResponse.json([]);
    }

    const employees = await prisma.employee.findMany({
      where: { companyId: { in: companyIds } },
      include: { company: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(employees);
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

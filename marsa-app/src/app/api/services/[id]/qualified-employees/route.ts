import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";

// GET /api/services/[id]/qualified-employees
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["ADMIN", "MANAGER"]);

    const { id } = await params;
    const rows = await prisma.userService.findMany({
      where: { serviceId: id },
      include: {
        user: { select: { id: true, name: true, role: true, phone: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json(rows.map((r) => r.user).filter(Boolean));
  } catch (e) {
    if (e instanceof Response) return e;
    console.error(e);
    return NextResponse.json({ error: "فشل التحميل" }, { status: 500 });
  }
}

// POST /api/services/[id]/qualified-employees  { userId }
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["ADMIN", "MANAGER"]);

    const { id } = await params;
    const body = await req.json();
    const { userId } = body || {};
    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ error: "userId مطلوب" }, { status: 400 });
    }

    const service = await prisma.service.findUnique({
      where: { id },
      select: { id: true, serviceTemplateId: true },
    });
    if (!service) {
      return NextResponse.json({ error: "الخدمة غير موجودة" }, { status: 404 });
    }

    const row = await prisma.userService.upsert({
      where: { userId_serviceId: { userId, serviceId: id } },
      create: {
        userId,
        serviceId: id,
        serviceTemplateId: service.serviceTemplateId || null,
      },
      update: {},
      include: {
        user: { select: { id: true, name: true, role: true, phone: true } },
      },
    });

    return NextResponse.json(row.user, { status: 201 });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error(e);
    return NextResponse.json({ error: "فشل الإضافة" }, { status: 500 });
  }
}

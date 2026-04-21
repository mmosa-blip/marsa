import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/api-auth";

export async function GET(request: Request) {
  try {
    const session = await requireAuth();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const where: Record<string, unknown> = {};

    if (session.user.role === "CLIENT") {
      where.clientId = session.user.id;
    } else if (!["ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    if (status) where.status = status;

    const requests = await prisma.serviceRequest.findMany({
      where,
      include: {
        client: { select: { id: true, name: true, email: true } },
        assignedTo: { select: { id: true, name: true } },
        items: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(requests);
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireRole(["CLIENT"]);

    const body = await request.json();

    if (!body.serviceTemplateIds || body.serviceTemplateIds.length === 0) {
      return NextResponse.json({ error: "يجب اختيار خدمة واحدة على الأقل" }, { status: 400 });
    }

    const templates = await prisma.serviceTemplate.findMany({
      where: { id: { in: body.serviceTemplateIds }, isActive: true },
    });

    if (templates.length === 0) {
      return NextResponse.json({ error: "القوالب غير موجودة" }, { status: 400 });
    }

    const totalPrice = templates.reduce((sum, t) => sum + (t.defaultPrice || 0), 0);

    const serviceRequest = await prisma.serviceRequest.create({
      data: {
        clientId: session.user.id,
        notes: body.notes || null,
        totalPrice,
        items: {
          create: templates.map((t) => ({
            name: t.name,
            description: t.description,
            price: t.defaultPrice,
            duration: t.defaultDuration,
            category: t.categoryId,
            templateId: t.id,
          })),
        },
      },
      include: { items: true },
    });

    return NextResponse.json(serviceRequest, { status: 201 });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

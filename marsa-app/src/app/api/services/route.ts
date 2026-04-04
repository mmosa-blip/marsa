import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const search = searchParams.get("search");

    const type = searchParams.get("type");

    const where: Record<string, unknown> = { isActive: true, deletedAt: null };

    // Only clients see public-only services
    if (session?.user.role === "CLIENT") {
      where.isPublic = true;
    }

    if (type) {
      where.type = type;
    }

    if (category) {
      where.category = category;
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const services = await prisma.service.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(services);
  } catch (error) {
    console.error("Error fetching services:", error);
    return NextResponse.json(
      { error: "حدث خطأ في جلب الخدمات" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "غير مصرح لك بإنشاء خدمات" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, description, category, price, duration, clientId } = body;

    if (!name || !clientId) {
      return NextResponse.json(
        { error: "اسم الخدمة والعميل مطلوبان" },
        { status: 400 }
      );
    }

    const service = await prisma.service.create({
      data: {
        name,
        description: description || null,
        category: category || null,
        price: price ? parseFloat(price) : null,
        duration: duration ? parseInt(duration) : null,
        clientId,
        type: body.type || "NORMAL",
      },
    });

    return NextResponse.json(service, { status: 201 });
  } catch (error) {
    console.error("Error creating service:", error);
    return NextResponse.json(
      { error: "حدث خطأ في إنشاء الخدمة" },
      { status: 500 }
    );
  }
}

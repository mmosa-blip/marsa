import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createMappingSchema } from "@/lib/validations";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (
      !session ||
      !["ADMIN", "MANAGER"].includes(session.user.role)
    ) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const serviceTemplateId = searchParams.get("serviceTemplateId");
    const providerId = searchParams.get("providerId");

    const where: Record<string, unknown> = {};

    if (serviceTemplateId) {
      where.serviceTemplateId = serviceTemplateId;
    }

    if (providerId) {
      where.providerId = providerId;
    }

    const mappings = await prisma.serviceProviderMapping.findMany({
      where,
      include: {
        serviceTemplate: {
          include: {
            category: true,
          },
        },
        provider: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            specialization: true,
          },
        },
      },
      orderBy: { priority: "asc" },
    });

    return NextResponse.json(mappings);
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (
      !session ||
      !["ADMIN", "MANAGER"].includes(session.user.role)
    ) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createMappingSchema.safeParse(body);
    if (!parsed.success) {
      const errors = parsed.error.issues.map((e: { message: string }) => e.message).join(", ");
      return NextResponse.json({ error: errors }, { status: 400 });
    }
    const { serviceTemplateId, providerId, priority, isActive } = parsed.data;

    // Check for duplicate mapping
    const existing = await prisma.serviceProviderMapping.findUnique({
      where: {
        serviceTemplateId_providerId: {
          serviceTemplateId,
          providerId,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "هذا الربط موجود بالفعل" },
        { status: 400 }
      );
    }

    const mapping = await prisma.serviceProviderMapping.create({
      data: {
        serviceTemplateId,
        providerId,
        priority: priority ?? 0,
        isActive: isActive ?? true,
      },
      include: {
        serviceTemplate: {
          include: {
            category: true,
          },
        },
        provider: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            specialization: true,
          },
        },
      },
    });

    return NextResponse.json(mapping, { status: 201 });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/api-auth";

export async function GET() {
  try {
    const session = await requireAuth();
    const isAdmin = ["ADMIN", "MANAGER"].includes(session.user.role);

    const templates = await prisma.contractTemplate.findMany({
      where: isAdmin ? {} : { isActive: true },
      include: {
        createdBy: { select: { id: true, name: true } },
        _count: { select: { contracts: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(templates);
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error fetching contract templates:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireRole(["ADMIN", "MANAGER"]);

    const { title, content, description, marginTop, marginBottom, marginLeft, marginRight, fontSize, textAlign, letterheadImage } = await request.json();

    if (!title || !content) {
      return NextResponse.json({ error: "العنوان والمحتوى مطلوبان" }, { status: 400 });
    }

    const existing = await prisma.contractTemplate.findFirst({
      where: { title },
    });
    if (existing) {
      return NextResponse.json(
        { error: "يوجد قالب بهذا الاسم مسبقاً. يرجى اختيار اسم مختلف." },
        { status: 400 }
      );
    }

    const template = await prisma.contractTemplate.create({
      data: {
        title,
        content,
        description: description || null,
        createdById: session.user.id,
        ...(marginTop !== undefined && { marginTop }),
        ...(marginBottom !== undefined && { marginBottom }),
        ...(marginLeft !== undefined && { marginLeft }),
        ...(marginRight !== undefined && { marginRight }),
        ...(fontSize !== undefined && { fontSize }),
        ...(textAlign !== undefined && { textAlign }),
        ...(letterheadImage !== undefined && { letterheadImage }),
      },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error creating contract template:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

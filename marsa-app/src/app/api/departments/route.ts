import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET — list all departments
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

    const departments = await prisma.department.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
      include: {
        _count: {
          select: {
            projects: true,
            services: true,
            employees: true,
          },
        },
      },
    });

    return NextResponse.json(departments);
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

// POST — create department (admin only)
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const body = await request.json();
    const { name, nameEn, description, color } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "اسم القسم مطلوب" }, { status: 400 });
    }

    const department = await prisma.department.create({
      data: {
        name: name.trim(),
        nameEn: nameEn?.trim() || null,
        description: description?.trim() || null,
        color: color || null,
      },
    });

    return NextResponse.json(department, { status: 201 });
  } catch (error) {
    console.error("Error:", error);
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "اسم القسم موجود مسبقاً" }, { status: 409 });
    }
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

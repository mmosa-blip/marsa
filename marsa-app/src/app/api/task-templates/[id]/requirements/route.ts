import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/task-templates/[id]/requirements
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const { id } = await params;
    const requirements = await prisma.taskRequirement.findMany({
      where: { taskTemplateId: id },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    });
    return NextResponse.json(requirements);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "فشل تحميل المتطلبات" }, { status: 500 });
  }
}

// POST /api/task-templates/[id]/requirements
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { label, type, options, isRequired, order } = body || {};

    if (!label || !type) {
      return NextResponse.json(
        { error: "الحقل (label) ونوع المتطلب (type) مطلوبان" },
        { status: 400 }
      );
    }

    const allowedTypes = ["TEXT", "FILE", "URL", "SELECT"];
    if (!allowedTypes.includes(type)) {
      return NextResponse.json(
        { error: "نوع متطلب غير مدعوم" },
        { status: 400 }
      );
    }

    // Ensure template exists
    const template = await prisma.taskTemplate.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!template) {
      return NextResponse.json({ error: "قالب المهمة غير موجود" }, { status: 404 });
    }

    // Serialise options if provided as array
    let optionsStr: string | null = null;
    if (type === "SELECT") {
      if (Array.isArray(options)) {
        optionsStr = JSON.stringify(options);
      } else if (typeof options === "string" && options.trim()) {
        optionsStr = options;
      }
    }

    const created = await prisma.taskRequirement.create({
      data: {
        taskTemplateId: id,
        label: String(label).trim(),
        type,
        options: optionsStr,
        isRequired: isRequired !== false,
        order: typeof order === "number" ? order : 0,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "فشل إنشاء المتطلب" }, { status: 500 });
  }
}

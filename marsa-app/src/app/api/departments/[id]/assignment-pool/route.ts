import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/api-auth";

// GET /api/departments/[id]/assignment-pool
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();

    const { id } = await params;
    const pool = await prisma.departmentAssignmentPool.findMany({
      where: { departmentId: id },
      orderBy: { order: "asc" },
      include: {
        user: {
          select: { id: true, name: true, email: true, phone: true, role: true },
        },
      },
    });
    return NextResponse.json(pool);
  } catch (e) {
    if (e instanceof Response) return e;
    console.error(e);
    return NextResponse.json({ error: "فشل تحميل فريق التوزيع" }, { status: 500 });
  }
}

// POST /api/departments/[id]/assignment-pool
// body: { userId, mode?, order? }
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["ADMIN", "MANAGER"]);

    const { id } = await params;
    const body = await req.json();
    const { userId, mode, order } = body || {};

    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ error: "userId مطلوب" }, { status: 400 });
    }

    const allowedModes = ["ROUND_ROBIN", "ALL"];
    const finalMode = allowedModes.includes(mode) ? mode : "ROUND_ROBIN";

    // Ensure department + user exist
    const [dept, user] = await Promise.all([
      prisma.department.findUnique({ where: { id }, select: { id: true } }),
      prisma.user.findUnique({ where: { id: userId }, select: { id: true } }),
    ]);
    if (!dept) {
      return NextResponse.json({ error: "القسم غير موجود" }, { status: 404 });
    }
    if (!user) {
      return NextResponse.json({ error: "المستخدم غير موجود" }, { status: 404 });
    }

    // Compute next order if not supplied
    let finalOrder = typeof order === "number" ? order : 0;
    if (typeof order !== "number") {
      const last = await prisma.departmentAssignmentPool.findFirst({
        where: { departmentId: id },
        orderBy: { order: "desc" },
        select: { order: true },
      });
      finalOrder = (last?.order ?? -1) + 1;
    }

    const created = await prisma.departmentAssignmentPool.upsert({
      where: { departmentId_userId: { departmentId: id, userId } },
      create: {
        departmentId: id,
        userId,
        mode: finalMode,
        order: finalOrder,
      },
      update: { mode: finalMode },
      include: {
        user: {
          select: { id: true, name: true, email: true, phone: true, role: true },
        },
      },
    });

    // When the mode changes, propagate it to all pool members in the same
    // department so the "mode" toggle applies to the whole pool.
    if (body?.applyModeToAll === true) {
      await prisma.departmentAssignmentPool.updateMany({
        where: { departmentId: id },
        data: { mode: finalMode },
      });
    }

    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error(e);
    return NextResponse.json({ error: "فشل إضافة العضو" }, { status: 500 });
  }
}

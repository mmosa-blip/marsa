import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PATCH /api/task-requirements/[id]
export async function PATCH(
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
    const data: Record<string, unknown> = {};

    if (typeof body.label === "string") data.label = body.label.trim();
    if (typeof body.type === "string") {
      const allowed = ["TEXT", "FILE", "URL", "SELECT"];
      if (!allowed.includes(body.type)) {
        return NextResponse.json({ error: "نوع متطلب غير مدعوم" }, { status: 400 });
      }
      data.type = body.type;
    }
    if (body.options !== undefined) {
      if (Array.isArray(body.options)) data.options = JSON.stringify(body.options);
      else if (typeof body.options === "string") data.options = body.options;
      else if (body.options === null) data.options = null;
    }
    if (typeof body.isRequired === "boolean") data.isRequired = body.isRequired;
    if (typeof body.order === "number") data.order = body.order;

    const updated = await prisma.taskRequirement.update({
      where: { id },
      data,
    });
    return NextResponse.json(updated);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "فشل تعديل المتطلب" }, { status: 500 });
  }
}

// DELETE /api/task-requirements/[id]
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const { id } = await params;
    await prisma.taskRequirement.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "فشل حذف المتطلب" }, { status: 500 });
  }
}

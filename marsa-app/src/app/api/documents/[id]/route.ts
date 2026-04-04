import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

    const { id } = await params;

    // التحقق من الملكية
    const doc = await prisma.document.findUnique({ where: { id }, select: { ownerId: true } });
    if (!doc) return NextResponse.json({ error: "الوثيقة غير موجودة" }, { status: 404 });

    if (doc.ownerId !== session.user.id && !["ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const body = await request.json();

    // حساب الحالة تلقائياً إذا تغير تاريخ الانتهاء
    if (body.expiryDate) {
      const expiry = new Date(body.expiryDate);
      const now = new Date();
      const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      if (expiry < now) body.status = "EXPIRED";
      else if (expiry <= thirtyDays) body.status = "EXPIRING_SOON";
      else body.status = "VALID";
      body.expiryDate = expiry;
    }
    if (body.issueDate) body.issueDate = new Date(body.issueDate);

    const updated = await prisma.document.update({
      where: { id },
      data: body,
      include: { company: { select: { name: true } } },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

    const { id } = await params;

    const doc = await prisma.document.findUnique({ where: { id }, select: { ownerId: true } });
    if (!doc) return NextResponse.json({ error: "الوثيقة غير موجودة" }, { status: 404 });

    if (doc.ownerId !== session.user.id && !["ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    await prisma.document.delete({ where: { id } });
    return NextResponse.json({ message: "تم حذف الوثيقة" });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

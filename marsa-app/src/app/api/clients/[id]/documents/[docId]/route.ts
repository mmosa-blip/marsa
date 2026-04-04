import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can, PERMISSIONS } from "@/lib/permissions";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    if (!(await can(session.user.id, session.user.role, PERMISSIONS.CLIENTS_EDIT))) {
      return NextResponse.json({ error: "ليس لديك صلاحية" }, { status: 403 });
    }

    const { docId } = await params;

    const doc = await prisma.clientDocument.findUnique({ where: { id: docId } });
    if (!doc) {
      return NextResponse.json({ error: "الوثيقة غير موجودة" }, { status: 404 });
    }

    await prisma.clientDocument.delete({ where: { id: docId } });

    return NextResponse.json({ message: "تم حذف الوثيقة بنجاح" });
  } catch (error) {
    console.error("Error deleting client document:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

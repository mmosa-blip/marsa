import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";

// DELETE /api/services/[id]/qualified-employees/[userId]
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    await requireRole(["ADMIN", "MANAGER"]);

    const { id, userId } = await params;
    await prisma.userService.delete({
      where: { userId_serviceId: { userId, serviceId: id } },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error(e);
    return NextResponse.json({ error: "فشل الحذف" }, { status: 500 });
  }
}

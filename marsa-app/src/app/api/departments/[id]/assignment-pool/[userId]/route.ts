import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";

// DELETE /api/departments/[id]/assignment-pool/[userId]
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    await requireRole(["ADMIN", "MANAGER"]);

    const { id, userId } = await params;
    await prisma.departmentAssignmentPool.delete({
      where: { departmentId_userId: { departmentId: id, userId } },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error(e);
    return NextResponse.json({ error: "فشل الحذف" }, { status: 500 });
  }
}

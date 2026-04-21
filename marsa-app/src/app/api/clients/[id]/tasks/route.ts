import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["ADMIN", "MANAGER"]);
    const { id } = await params;

    // مهام المشاريع الخاصة بالعميل
    const tasks = await prisma.task.findMany({
      where: { project: { clientId: id } },
      include: {
        project: { select: { id: true, name: true, projectCode: true } },
        service: { select: { name: true } },
        assignee: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(tasks);
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

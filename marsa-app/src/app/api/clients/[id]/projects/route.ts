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
    const projects = await prisma.project.findMany({
      where: { clientId: id, deletedAt: null },
      include: {
        tasks: { select: { id: true, status: true } },
        manager: { select: { name: true } },
        invoices: { select: { totalAmount: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const result = projects.map((p) => ({
      ...p,
      progress: p.tasks.length > 0 ? Math.round((p.tasks.filter((t) => t.status === "DONE").length / p.tasks.length) * 100) : 0,
      totalTasks: p.tasks.length,
      completedTasks: p.tasks.filter((t) => t.status === "DONE").length,
    }));

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

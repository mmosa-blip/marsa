import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }
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
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

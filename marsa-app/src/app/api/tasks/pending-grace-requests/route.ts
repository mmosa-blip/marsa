import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";

// GET /api/tasks/pending-grace-requests
// ADMIN/MANAGER only — returns tasks with a pending (unapproved) grace request.
export async function GET() {
  try {
    await requireRole(["ADMIN", "MANAGER"]);

    const tasks = await prisma.task.findMany({
      where: {
        taskGraceDays: { not: null },
        taskGraceApproved: false,
        deletedAt: null,
      },
      include: {
        project: { select: { id: true, name: true, projectCode: true } },
        assignee: { select: { id: true, name: true } },
        service: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json(tasks);
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("pending-grace-requests error:", e);
    return NextResponse.json(
      { error: "فشل جلب طلبات الإمهال" },
      { status: 500 }
    );
  }
}

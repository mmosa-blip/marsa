import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/tasks/pending-grace-requests
// ADMIN/MANAGER only — returns tasks with a pending (unapproved) grace request.
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const isStaff = ["ADMIN", "MANAGER"].includes(session.user.role);
    if (!isStaff) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

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
    console.error("pending-grace-requests error:", e);
    return NextResponse.json(
      { error: "فشل جلب طلبات الإمهال" },
      { status: 500 }
    );
  }
}

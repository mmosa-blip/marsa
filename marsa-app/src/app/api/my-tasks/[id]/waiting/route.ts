import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const { id } = await params;
    const { mode, governmentEntity } = await request.json();

    if (mode === null) {
      // Clear waiting mode — resume task
      await prisma.task.update({
        where: { id },
        data: { waitingMode: null, status: "IN_PROGRESS" },
      });
      return NextResponse.json({ ok: true });
    }

    await prisma.task.update({
      where: { id },
      data: { waitingMode: mode },
    });

    // PROVIDER and GOVERNMENT modes both store as TaskGovernmentHold —
    // the entity field carries the supplier name or the government body
    // name. The Task.waitingMode tells the UI which label to show.
    if (mode === "PROVIDER" || mode === "GOVERNMENT") {
      await prisma.taskGovernmentHold.updateMany({
        where: { taskId: id, isActive: true },
        data: { isActive: false },
      });
      await prisma.taskGovernmentHold.create({
        data: {
          taskId: id,
          heldById: session.user.id,
          entity: governmentEntity || null,
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error setting waiting mode:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

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
    const { linkId, action, completedByProvider } = await request.json();

    if (action === "reopen") {
      await prisma.taskExternalProvider.update({
        where: { id: linkId },
        data: { providerStatus: "REOPENED", completedAt: null, completedByProvider: false },
      });
      await prisma.task.update({
        where: { id },
        data: { status: "IN_PROGRESS", waitingMode: "PROVIDER" },
      });
      return NextResponse.json({ ok: true });
    }

    await prisma.taskExternalProvider.update({
      where: { id: linkId },
      data: {
        providerStatus: "COMPLETED",
        completedAt: new Date(),
        completedByProvider: completedByProvider || false,
      },
    });

    if (completedByProvider) {
      await prisma.task.update({
        where: { id },
        data: { status: "DONE", waitingMode: null },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error completing provider task:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

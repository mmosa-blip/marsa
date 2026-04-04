import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  // Get all user-service links
  const userServices = await prisma.userService.findMany({
    select: { userId: true, serviceId: true },
  });

  let totalUpdated = 0;

  for (const us of userServices) {
    const service = await prisma.service.findUnique({
      where: { id: us.serviceId },
      select: {
        project: { select: { status: true } },
        tasks: { where: { assigneeId: null }, select: { id: true } },
      },
    });

    if (service?.project?.status === "ACTIVE" && service.tasks.length > 0) {
      const result = await prisma.task.updateMany({
        where: { id: { in: service.tasks.map(t => t.id) }, assigneeId: null },
        data: { assigneeId: us.userId },
      });
      totalUpdated += result.count;
    }
  }

  return NextResponse.json({ message: `تم إسناد ${totalUpdated} مهمة` });
}

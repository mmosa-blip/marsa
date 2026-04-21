import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const service = await prisma.service.findUnique({
      where: { id },
    });

    if (!service) {
      return NextResponse.json(
        { error: "الخدمة غير موجودة" },
        { status: 404 }
      );
    }

    return NextResponse.json(service);
  } catch (error) {
    console.error("Error fetching service:", error);
    return NextResponse.json(
      { error: "حدث خطأ في جلب الخدمة" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["ADMIN", "MANAGER"]);

    const { id } = await params;
    const now = new Date();

    // Cascade soft-delete to every task in this service so the tasks
    // disappear from queues alongside the service. The tasks keep their
    // history (time logs, audit trail), they're just hidden from the
    // active listings via the deletedAt filter.
    await prisma.task.updateMany({
      where: { serviceId: id, deletedAt: null },
      data: { deletedAt: now },
    });

    await prisma.service.update({
      where: { id },
      data: { deletedAt: now },
    });

    return NextResponse.json({ message: "تم حذف الخدمة" });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

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
    const services = await prisma.service.findMany({
      where: { clientId: id },
      include: {
        tasks: { select: { id: true, status: true, title: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(services);
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

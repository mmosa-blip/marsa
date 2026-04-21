import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";

export async function GET() {
  try {
    await requireRole(["ADMIN", "MANAGER"]);

    const providers = await prisma.user.findMany({
      where: {
        role: { in: ["EXECUTOR", "EXTERNAL_PROVIDER"] },
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        role: true,
        specialization: true,
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(providers);
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

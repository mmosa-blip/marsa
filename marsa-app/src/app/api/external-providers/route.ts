import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const providers = await prisma.user.findMany({
      where: { role: "EXTERNAL_PROVIDER", deletedAt: null, isActive: true },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        specialization: true,
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(providers);
  } catch (error) {
    console.error("Error fetching external providers:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

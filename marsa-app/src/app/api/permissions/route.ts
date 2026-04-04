import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const all = await prisma.permission.findMany({
      orderBy: [{ module: "asc" }, { label: "asc" }],
    });

    // Group by module
    const grouped: Record<string, typeof all> = {};
    for (const p of all) {
      if (!grouped[p.module]) grouped[p.module] = [];
      grouped[p.module].push(p);
    }

    return NextResponse.json({ permissions: all, grouped });
  } catch (error) {
    console.error("Error fetching permissions:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

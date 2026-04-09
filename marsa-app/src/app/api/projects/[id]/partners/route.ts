import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/projects/[id]/partners
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const { id } = await params;
    const partners = await prisma.projectPartner.findMany({
      where: { projectId: id },
      orderBy: { order: "asc" },
      select: { id: true, name: true, order: true },
    });
    return NextResponse.json(partners);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "فشل التحميل" }, { status: 500 });
  }
}

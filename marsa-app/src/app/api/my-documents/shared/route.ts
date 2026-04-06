import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET — list project documents shared with the client
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "CLIENT") {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const userId = session.user.id;

    const documents = await prisma.projectDocument.findMany({
      where: {
        isSharedWithClient: true,
        project: { clientId: userId },
      },
      include: {
        documentType: {
          select: { id: true, name: true, kind: true, description: true, fields: true },
        },
        project: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(documents);
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

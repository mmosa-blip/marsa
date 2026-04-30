import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recordItemToProjectDocument } from "@/lib/record-shape-adapter";
import { logger } from "@/lib/logger";

// GET — list project documents shared with the client
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "CLIENT") {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const userId = session.user.id;

    // ─── Phase C — read from the new record system ───────────────────
    // Reads ProjectRecordItem rows tagged [PD:...] for projects owned
    // by this client where the row is shared with them. Adapts back to
    // ProjectDocument shape (with the project join the UI expects).
    const recordItems = await prisma.projectRecordItem.findMany({
      where: {
        isSharedWithClient: true,
        project: { clientId: userId },
        deletedAt: null,
        title: { contains: "[PD:" },
      },
      include: {
        documentType: {
          select: {
            id: true,
            name: true,
            kind: true,
            description: true,
            fields: true,
            // Cast the include to match the adapter's expected shape.
            // `group` is needed because the adapter optionally surfaces it.
            group: { select: { id: true, name: true, displayOrder: true } },
          },
        },
        project: { select: { id: true, name: true, clientId: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    if (recordItems.length > 0) {
      const adapted = recordItems
        .map((it) => recordItemToProjectDocument(it))
        .filter((x): x is NonNullable<typeof x> => x !== null);
      return NextResponse.json(adapted);
    }

    // Fallback path — legacy table only.
    logger.warn("my-documents/shared: no record-system rows, falling back to legacy", { userId });
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

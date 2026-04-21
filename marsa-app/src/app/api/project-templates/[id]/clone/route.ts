import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["ADMIN", "MANAGER"]);

    const { id } = await params;

    const original = await prisma.projectTemplate.findUnique({
      where: { id },
      include: {
        services: {
          include: {
            serviceTemplate: {
              include: {
                taskTemplates: { orderBy: { sortOrder: "asc" } },
              },
            },
          },
          orderBy: { sortOrder: "asc" },
        },
        milestones: { orderBy: { order: "asc" } },
      },
    });

    if (!original) {
      return NextResponse.json({ error: "القالب غير موجود" }, { status: 404 });
    }

    return NextResponse.json({ template: original });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error cloning project template:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

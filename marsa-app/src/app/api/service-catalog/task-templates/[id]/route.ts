import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["ADMIN", "MANAGER"]);

    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.taskTemplate.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "قالب المهمة غير موجود" },
        { status: 404 }
      );
    }

    const { name, description, defaultDuration, sortOrder, isRequired, executionMode, sameDay } = body;

    const taskTemplate = await prisma.taskTemplate.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(defaultDuration !== undefined && { defaultDuration }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(isRequired !== undefined && { isRequired }),
        ...(executionMode !== undefined && { executionMode }),
        ...(sameDay !== undefined && { sameDay }),
      },
    });

    return NextResponse.json(taskTemplate);
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("خطأ في تحديث قالب المهمة:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء تحديث قالب المهمة" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["ADMIN", "MANAGER"]);

    const { id } = await params;

    const existing = await prisma.taskTemplate.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "قالب المهمة غير موجود" },
        { status: 404 }
      );
    }

    await prisma.taskTemplate.delete({
      where: { id },
    });

    return NextResponse.json(
      { message: "تم حذف قالب المهمة بنجاح" }
    );
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("خطأ في حذف قالب المهمة:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء حذف قالب المهمة" },
      { status: 500 }
    );
  }
}

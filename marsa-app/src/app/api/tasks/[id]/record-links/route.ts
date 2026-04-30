import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { canViewRecordItem } from "@/lib/record-visibility";

/**
 * GET /api/tasks/[id]/record-links
 *
 * Returns the record items linked to a task as completion requirements,
 * filtered by what the current viewer is allowed to see. Powers the
 * pre-completion modal.
 *
 * POST /api/tasks/[id]/record-links { recordItemId, isRequired? }
 * DELETE /api/tasks/[id]/record-links?linkId=...
 *
 * ADMIN / MANAGER manage links (single-source-of-truth — see Tier 4).
 */

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id: taskId } = await params;

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, projectId: true },
    });
    if (!task) {
      return NextResponse.json({ error: "المهمة غير موجودة" }, { status: 404 });
    }

    const project = task.projectId
      ? await prisma.project.findUnique({
          where: { id: task.projectId },
          select: { clientId: true },
        })
      : null;

    const links = await prisma.taskRequirementLink.findMany({
      where: { taskId },
      include: {
        recordItem: {
          include: {
            documentType: { select: { id: true, name: true } },
            partner: {
              select: { id: true, partnerNumber: true, name: true },
            },
            service: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // Filter on visibility — viewers can only see what they're allowed
    // to see in the unified record.
    const projectClientId = project?.clientId ?? "";
    const visible = links.filter((l) =>
      canViewRecordItem({
        role: session.user.role,
        userId: session.user.id,
        projectClientId,
        item: {
          visibility: l.recordItem.visibility,
          isSharedWithClient: l.recordItem.isSharedWithClient,
          uploadedById: l.recordItem.uploadedById,
        },
      })
    );

    return NextResponse.json(visible);
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("record-links GET", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    if (!["ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }
    const { id: taskId } = await params;
    const body = await request.json();
    const recordItemId = String(body.recordItemId ?? "");
    if (!recordItemId) {
      return NextResponse.json(
        { error: "recordItemId مطلوب" },
        { status: 400 }
      );
    }

    // Sanity check the (task, record-item) belong to the same project.
    const [task, item] = await Promise.all([
      prisma.task.findUnique({
        where: { id: taskId },
        select: { id: true, projectId: true },
      }),
      prisma.projectRecordItem.findUnique({
        where: { id: recordItemId },
        select: { id: true, projectId: true, deletedAt: true },
      }),
    ]);
    if (!task) {
      return NextResponse.json({ error: "المهمة غير موجودة" }, { status: 404 });
    }
    if (!item || item.deletedAt) {
      return NextResponse.json({ error: "العنصر غير موجود" }, { status: 404 });
    }
    if (task.projectId && item.projectId !== task.projectId) {
      return NextResponse.json(
        { error: "العنصر ينتمي لمشروع آخر" },
        { status: 400 }
      );
    }

    const link = await prisma.taskRequirementLink.upsert({
      where: { taskId_recordItemId: { taskId, recordItemId } },
      create: {
        taskId,
        recordItemId,
        isRequired: body.isRequired !== false,
      },
      update: { isRequired: body.isRequired !== false },
    });

    return NextResponse.json(link, { status: 201 });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("record-links POST", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    if (!["ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }
    const { id: taskId } = await params;
    const url = new URL(request.url);
    const linkId = url.searchParams.get("linkId");
    if (!linkId) {
      return NextResponse.json({ error: "linkId مطلوب" }, { status: 400 });
    }
    const link = await prisma.taskRequirementLink.findFirst({
      where: { id: linkId, taskId },
      select: { id: true },
    });
    if (!link) {
      return NextResponse.json({ error: "غير موجود" }, { status: 404 });
    }
    await prisma.taskRequirementLink.delete({ where: { id: linkId } });
    return NextResponse.json({ success: true });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("record-links DELETE", e);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

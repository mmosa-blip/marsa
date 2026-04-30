import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { getBlockingTaskRecordLinks } from "@/lib/record-spawn";
import { mirrorTaskRequirementValueUpsert } from "@/lib/record-dual-write";

interface IncomingValue {
  requirementId: string;
  textValue?: string | null;
  fileUrl?: string | null;
  selectedOption?: string | null;
}

// POST /api/tasks/[id]/requirements/complete
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();

    const { id } = await params;
    const body = await req.json();
    const incoming: IncomingValue[] = Array.isArray(body?.values) ? body.values : [];

    const task = await prisma.task.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        assigneeId: true,
        taskTemplateId: true,
        taskTemplate: {
          select: {
            requirements: true,
          },
        },
        linkedInstallment: { select: { isLocked: true, title: true } },
      },
    });

    if (!task) {
      return NextResponse.json({ error: "المهمة غير موجودة" }, { status: 404 });
    }

    // Respect the payment-task lock gate
    if (task.linkedInstallment?.isLocked) {
      return NextResponse.json(
        { error: `المهمة محظورة حتى يتم دفع الدفعة: ${task.linkedInstallment.title}` },
        { status: 403 }
      );
    }

    // Only the assignee (or an admin/manager) can complete
    const canComplete =
      ["ADMIN", "MANAGER"].includes(session.user.role) ||
      task.assigneeId === session.user.id;
    if (!canComplete) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const requirements = task.taskTemplate?.requirements ?? [];
    const byId = new Map(requirements.map((r) => [r.id, r]));

    // Persist submitted values (only those pointing at known requirements of this template)
    // Need projectId / serviceId / assigneeId for the dual-write mirror,
    // so re-load the task once with the join.
    const taskMeta = await prisma.task.findUnique({
      where: { id: task.id },
      select: { projectId: true, serviceId: true, assigneeId: true },
    });

    for (const v of incoming) {
      const r = byId.get(v.requirementId);
      if (!r) continue;

      const data = {
        textValue: v.textValue ?? null,
        fileUrl: v.fileUrl ?? null,
        selectedOption: v.selectedOption ?? null,
      };

      const upserted = await prisma.taskRequirementValue.upsert({
        where: {
          requirementId_taskId: {
            requirementId: r.id,
            taskId: task.id,
          },
        },
        create: {
          requirementId: r.id,
          taskId: task.id,
          ...data,
        },
        update: data,
      });

      // Phase B — dual-write to record system. Best-effort, never throws.
      // Only file uploads have a meaningful mirror; text/select skipped.
      if (upserted.fileUrl && taskMeta) {
        void mirrorTaskRequirementValueUpsert({
          id: upserted.id,
          taskId: upserted.taskId,
          fileUrl: upserted.fileUrl,
          requirement: { label: r.label, isRequired: r.isRequired },
          task: {
            projectId: taskMeta.projectId,
            serviceId: taskMeta.serviceId,
            assigneeId: taskMeta.assigneeId,
          },
        });
      }
    }

    // Re-read the stored values for completeness check
    const storedValues = await prisma.taskRequirementValue.findMany({
      where: { taskId: task.id },
    });
    const valueById = new Map(storedValues.map((v) => [v.requirementId, v]));

    const missing: { id: string; label: string }[] = [];
    for (const r of requirements) {
      if (!r.isRequired) continue;
      const v = valueById.get(r.id);
      const hasContent =
        !!v &&
        ((r.type === "TEXT" && !!v.textValue && v.textValue.trim() !== "") ||
          (r.type === "URL" && !!v.textValue && v.textValue.trim() !== "") ||
          (r.type === "FILE" && !!v.fileUrl) ||
          (r.type === "SELECT" && !!v.selectedOption));
      if (!hasContent) {
        missing.push({ id: r.id, label: r.label });
      }
    }

    if (missing.length > 0) {
      return NextResponse.json(
        { error: "يوجد متطلبات ناقصة", missing },
        { status: 400 }
      );
    }

    // Tier 4 — also block on linked record items that aren't APPROVED.
    const blockingRecordItems = await getBlockingTaskRecordLinks(task.id);
    if (blockingRecordItems.length > 0) {
      return NextResponse.json(
        {
          error: "لا يمكن إنهاء المهمة — توجد متطلبات سجل ناقصة",
          blockingRecordItems,
        },
        { status: 400 }
      );
    }

    // Mark the task as done
    await prisma.task.update({
      where: { id: task.id },
      data: { status: "DONE" },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error(e);
    return NextResponse.json({ error: "فشل حفظ متطلبات الإكمال" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

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
    for (const v of incoming) {
      const r = byId.get(v.requirementId);
      if (!r) continue;

      const data = {
        textValue: v.textValue ?? null,
        fileUrl: v.fileUrl ?? null,
        selectedOption: v.selectedOption ?? null,
      };

      await prisma.taskRequirementValue.upsert({
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

    // Mark the task as done
    await prisma.task.update({
      where: { id: task.id },
      data: { status: "DONE" },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "فشل حفظ متطلبات الإكمال" }, { status: 500 });
  }
}

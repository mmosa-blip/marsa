import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";
import { logger } from "@/lib/logger";
import { deriveProjectPaymentFrozen } from "@/lib/city-state";

// GET /api/admin/all-cities
//
// Sister endpoint to /api/projects?withServices=true but without the
// per-role assignee filter. Returns every non-deleted project with its
// services + tasks (the same shape executor-city expects) so the admin
// "unified city" page can render every executor's buildings on one
// canvas.
//
// Each project additionally carries a distinct list of executors
// (assignees of its tasks) so the canvas can label towers and the
// header dropdown can filter by person.
//
// Auth: ADMIN / MANAGER only.
export async function GET() {
  try {
    await requireRole(["ADMIN", "MANAGER"]);

    const projects = await prisma.project.findMany({
      where: { deletedAt: null },
      include: {
        client: { select: { id: true, name: true, email: true } },
        manager: { select: { id: true, name: true, email: true } },
        department: { select: { id: true, name: true, nameEn: true, color: true } },
        // Live contract.endDate for getEffectiveDeadline (earliest-wins).
        contract: { select: { endDate: true } },
        // Open pause row (endDate IS NULL) — at most one per project. Drives
        // the canvas's choice between PAYMENT_FROZEN / CLIENT_HOLD / ADMIN_PAUSED.
        pauses: {
          where: { endDate: null },
          orderBy: { startDate: "desc" },
          take: 1,
          select: { reason: true, notes: true, startDate: true },
        },
        tasks: {
          select: {
            id: true,
            status: true,
            dueDate: true,
            assignee: { select: { id: true, name: true } },
            // For deriveProjectPaymentFrozen — at most one installment per task.
            linkedInstallment: {
              select: { isLocked: true, order: true, paymentStatus: true },
            },
          },
        },
        services: {
          select: {
            id: true,
            name: true,
            status: true,
            tasks: { select: { id: true, status: true, dueDate: true } },
          },
          orderBy: { serviceOrder: "asc" },
          where: { deletedAt: null },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const enriched = projects.map((p) => {
      const total = p.tasks.length;
      const done = p.tasks.filter((t) => t.status === "DONE").length;

      // Distinct executors derived from task.assignee. Order: by name.
      const map = new Map<string, string>();
      for (const t of p.tasks) {
        if (t.assignee?.id) map.set(t.assignee.id, t.assignee.name);
      }
      const executors = Array.from(map.entries())
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name, "ar"));

      // Strip assignee from each task before sending — the canvas only
      // needs id/status/dueDate, and we already aggregated executors.
      const tasks = p.tasks.map((t) => ({
        id: t.id,
        status: t.status,
        dueDate: t.dueDate,
      }));

      // Derive paymentFrozen on the server before stripping linkedInstallment.
      const paymentFrozen = deriveProjectPaymentFrozen(p.tasks);

      // Surface the open pause row's reason / note / startedAt for the
      // canvas's hybrid state derivation. Stripped from the wire shape so
      // we don't ship the whole `pauses` array.
      const openPause = p.pauses?.[0] ?? null;
      const pauseReason = openPause?.reason ?? null;
      const pauseNote = openPause?.notes ?? null;
      const pausedAt = openPause?.startDate ?? null;
      const { pauses: _drop, ...rest } = p;
      void _drop;

      return {
        ...rest,
        tasks,
        progress: total > 0 ? Math.round((done / total) * 100) : 0,
        totalTasks: total,
        completedTasks: done,
        executors,
        paymentFrozen,
        pauseReason,
        pauseNote,
        pausedAt,
      };
    });

    return NextResponse.json({ projects: enriched });
  } catch (e) {
    if (e instanceof Response) return e;
    logger.error("admin/all-cities error", e);
    return NextResponse.json({ error: "فشل تحميل بيانات المدن" }, { status: 500 });
  }
}

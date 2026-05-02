import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { spawnRecordItemsForProject } from "@/lib/record-spawn";

// ═══════════════════════════════════════════════════════════════════════
// Tier 5 — live sync of ServiceTemplateRequirement edits into active
// projects already instantiated from the template.
// ═══════════════════════════════════════════════════════════════════════
//
// Three entry points correspond to the three admin-side mutations:
//
//   syncRequirementCreated(requirementId)
//     → Calls spawnRecordItemsForProject for every active project of
//       the template. The spawn helper is already idempotent — only
//       the new requirement triggers fresh rows.
//
//   syncRequirementUpdated(requirementId, changes)
//     → Walks ProjectRecordItem rows pinned to this requirement. When
//       isRequired flips, all rows update. When label / documentTypeId
//       changes, only un-uploaded rows update (status ∈ {MISSING,
//       DRAFT}) so already-uploaded data is never mutated.
//
//   syncRequirementDeleted(requirementId)
//     → Splits ProjectRecordItem rows into "untouched" (deleted) vs
//       "uploaded" (marked isObsolete=true so they stay for audit but
//       don't gate completion).
//
// Each helper returns a summary of what changed across the active
// projects, so a UI confirmation modal can show the blast radius
// before/after.

export interface SyncSummary {
  affectedProjects: number;
  spawned: number;
  reused: number;
  updated: number;
  archived: number;
  deleted: number;
  errors: number;
}

function emptySummary(): SyncSummary {
  return {
    affectedProjects: 0,
    spawned: 0,
    reused: 0,
    updated: 0,
    archived: 0,
    deleted: 0,
    errors: 0,
  };
}

// Project counts as "active" when not deleted and not COMPLETED — we
// don't touch closed projects, history is sacred.
async function activeProjectsForTemplate(
  serviceTemplateId: string
): Promise<{ id: string }[]> {
  // Walk Service rows because projects connect to a service template
  // through their child Service, not directly.
  const services = await prisma.service.findMany({
    where: {
      serviceTemplateId,
      deletedAt: null,
      project: {
        deletedAt: null,
        status: { notIn: ["COMPLETED", "CANCELLED"] },
      },
    },
    select: { projectId: true },
  });
  // Dedup project ids — a project might in theory hold the same
  // service template twice (rare, but the schema allows it).
  const ids = Array.from(
    new Set(services.map((s) => s.projectId).filter((x): x is string => !!x))
  );
  return ids.map((id) => ({ id }));
}

// ─────────────────────────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────────────────────────

export async function syncRequirementCreated(
  requirementId: string
): Promise<SyncSummary> {
  const summary = emptySummary();
  const req = await prisma.serviceTemplateRequirement.findUnique({
    where: { id: requirementId },
    select: { serviceTemplateId: true },
  });
  if (!req) return summary;

  const projects = await activeProjectsForTemplate(req.serviceTemplateId);
  summary.affectedProjects = projects.length;

  for (const p of projects) {
    try {
      const r = await spawnRecordItemsForProject(p.id);
      summary.spawned += r.spawned;
      summary.reused += r.reused;
    } catch (err) {
      summary.errors++;
      logger.warn("syncRequirementCreated failed for project", {
        projectId: p.id,
        error: String(err),
      });
    }
  }
  return summary;
}

// ─────────────────────────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────────────────────────

export interface RequirementUpdatePatch {
  label?: string | null;
  documentTypeId?: string | null;
  isRequired?: boolean;
  isPerPartner?: boolean;
}

export async function syncRequirementUpdated(
  requirementId: string,
  patch: RequirementUpdatePatch
): Promise<SyncSummary> {
  const summary = emptySummary();
  const req = await prisma.serviceTemplateRequirement.findUnique({
    where: { id: requirementId },
    select: {
      serviceTemplateId: true,
      isPerPartner: true,
      taskTemplateId: true,
    },
  });
  if (!req) return summary;

  const projects = await activeProjectsForTemplate(req.serviceTemplateId);
  summary.affectedProjects = projects.length;

  // 1) Cheap broadcasts: isRequired / label / documentTypeId.
  const dataAll: Record<string, unknown> = {};
  const dataUntouched: Record<string, unknown> = {};

  if (typeof patch.isRequired === "boolean") {
    // isRequired isn't on ProjectRecordItem itself — it's stored on
    // the SOURCE requirement. The blocking guards already read from
    // sourceTemplateRequirement.isRequired, so we don't need to touch
    // the spawned rows here. (Empty branch — left explicit for clarity.)
  }
  if (typeof patch.label === "string") {
    dataUntouched.title = patch.label;
  }
  if ("documentTypeId" in patch) {
    dataUntouched.documentTypeId = patch.documentTypeId ?? null;
  }

  if (Object.keys(dataAll).length > 0) {
    try {
      const res = await prisma.projectRecordItem.updateMany({
        where: {
          sourceTemplateRequirementId: requirementId,
          deletedAt: null,
          isObsolete: false,
        },
        data: dataAll,
      });
      summary.updated += res.count;
    } catch (err) {
      summary.errors++;
      logger.warn("syncRequirementUpdated dataAll failed", {
        error: String(err),
      });
    }
  }

  if (Object.keys(dataUntouched).length > 0) {
    try {
      // Only items the executor / client haven't uploaded yet — anything
      // already PENDING_REVIEW or APPROVED keeps its current title and
      // doc-type to preserve history.
      const res = await prisma.projectRecordItem.updateMany({
        where: {
          sourceTemplateRequirementId: requirementId,
          deletedAt: null,
          isObsolete: false,
          status: { in: ["MISSING", "DRAFT"] },
        },
        data: dataUntouched,
      });
      summary.updated += res.count;
    } catch (err) {
      summary.errors++;
      logger.warn("syncRequirementUpdated dataUntouched failed", {
        error: String(err),
      });
    }
  }

  // 2) isPerPartner toggled ON → spawn missing per-partner rows. The
  //    spawn helper is idempotent so no harm in calling it always —
  //    but only when the flag was flipped TO true to avoid wasted work.
  if (patch.isPerPartner === true && !req.isPerPartner) {
    for (const p of projects) {
      try {
        const r = await spawnRecordItemsForProject(p.id);
        summary.spawned += r.spawned;
      } catch (err) {
        summary.errors++;
        logger.warn("syncRequirementUpdated spawn failed", {
          projectId: p.id,
          error: String(err),
        });
      }
    }
  }
  // Flipping isPerPartner=true→false intentionally keeps the existing
  // per-partner rows. Removing them silently would lose data.

  return summary;
}

// ─────────────────────────────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────────────────────────────

export async function syncRequirementDeleted(
  requirementId: string
): Promise<SyncSummary> {
  const summary = emptySummary();

  // Distinct projects touched, computed before the row deletion happens
  // server-side (Prisma's onDelete sets sourceTemplateRequirementId
  // = NULL, so we must capture project ids first).
  const items = await prisma.projectRecordItem.findMany({
    where: {
      sourceTemplateRequirementId: requirementId,
      deletedAt: null,
    },
    select: { id: true, projectId: true, status: true, fileUrl: true, textData: true },
  });
  summary.affectedProjects = new Set(items.map((i) => i.projectId)).size;

  // Untouched rows (no upload yet) → soft delete.
  // Uploaded rows → mark obsolete so the data stays for audit but the
  // blocking checks ignore them.
  const untouched = items.filter(
    (i) =>
      i.status === "MISSING" ||
      i.status === "DRAFT" ||
      (!i.fileUrl && !i.textData)
  );
  const uploaded = items.filter((i) => !untouched.includes(i));

  if (untouched.length > 0) {
    try {
      const r = await prisma.projectRecordItem.updateMany({
        where: { id: { in: untouched.map((u) => u.id) } },
        data: { deletedAt: new Date() },
      });
      summary.deleted += r.count;
    } catch (err) {
      summary.errors++;
      logger.warn("syncRequirementDeleted untouched-delete failed", {
        error: String(err),
      });
    }
  }
  if (uploaded.length > 0) {
    try {
      const r = await prisma.projectRecordItem.updateMany({
        where: { id: { in: uploaded.map((u) => u.id) } },
        data: { isObsolete: true, obsoletedAt: new Date() },
      });
      summary.archived += r.count;
    } catch (err) {
      summary.errors++;
      logger.warn("syncRequirementDeleted archive failed", {
        error: String(err),
      });
    }
  }

  return summary;
}

// ─────────────────────────────────────────────────────────────────
// PREVIEW
// ─────────────────────────────────────────────────────────────────
// Lets the UI ask "what would happen if I {created|updated|deleted}
// this?" before showing the confirmation modal. Pure read-only.

export async function previewRequirementSync(
  requirementId: string,
  action: "create" | "update" | "delete"
): Promise<{
  affectedProjects: number;
  toSpawn: number;
  toUpdate: number;
  toArchive: number;
  toDelete: number;
}> {
  const req = await prisma.serviceTemplateRequirement.findUnique({
    where: { id: requirementId },
    select: { serviceTemplateId: true, isPerPartner: true },
  });
  if (!req)
    return { affectedProjects: 0, toSpawn: 0, toUpdate: 0, toArchive: 0, toDelete: 0 };

  const projects = await activeProjectsForTemplate(req.serviceTemplateId);
  let toSpawn = 0;
  let toUpdate = 0;
  let toArchive = 0;
  let toDelete = 0;

  if (action === "create") {
    // Each active project gets one spawn (or per-partner expansion).
    for (const p of projects) {
      const partners = req.isPerPartner
        ? await prisma.projectPartner.count({ where: { projectId: p.id } })
        : 1;
      toSpawn += partners;
    }
  } else if (action === "update") {
    // We can update untouched rows; uploaded rows survive untouched.
    const items = await prisma.projectRecordItem.findMany({
      where: {
        sourceTemplateRequirementId: requirementId,
        deletedAt: null,
        isObsolete: false,
      },
      select: { status: true },
    });
    for (const it of items) {
      if (it.status === "MISSING" || it.status === "DRAFT") toUpdate++;
    }
  } else if (action === "delete") {
    const items = await prisma.projectRecordItem.findMany({
      where: { sourceTemplateRequirementId: requirementId, deletedAt: null },
      select: { status: true, fileUrl: true, textData: true },
    });
    for (const it of items) {
      const untouched =
        it.status === "MISSING" ||
        it.status === "DRAFT" ||
        (!it.fileUrl && !it.textData);
      if (untouched) toDelete++;
      else toArchive++;
    }
  }

  return {
    affectedProjects: projects.length,
    toSpawn,
    toUpdate,
    toArchive,
    toDelete,
  };
}

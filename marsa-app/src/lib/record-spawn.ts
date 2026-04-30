import { prisma } from "@/lib/prisma";

// ═══════════════════════════════════════════════════════════════════════
// Tier 4 — record-item spawning + reuse + completion guards
// ═══════════════════════════════════════════════════════════════════════
// When a project is instantiated from a template (or when a partner is
// later added), every `ServiceTemplateRequirement` linked to one of the
// project's services should produce a corresponding `ProjectRecordItem`
// in MISSING status so the team has a punch list.
//
// Two expansion rules:
//   - isPerPartner=false → one row per (project, service, requirement).
//   - isPerPartner=true  → one row per (project, service, requirement,
//                          partner) for every existing partner. If no
//                          partners exist yet, nothing is spawned for
//                          per-partner requirements; calling
//                          `spawnRecordItemsForPartner` later fills them
//                          in retroactively when a partner is added.
//
// Reuse: when a CLIENT-scoped record item (same client + documentType)
// already has APPROVED status on another project of the same client,
// the new spawn is suppressed. Admins still see the upstream item from
// the unified record because the visibility helpers expose
// CLIENT_AND_ADMIN items across the client's projects via the Tier 7
// /api/clients/[id]/record endpoint. The point of the suppression here
// is just to avoid creating duplicate MISSING placeholders for things
// that are already in hand.

interface SpawnSummary {
  spawned: number;
  reused: number;
  skipped: number;
}

/**
 * Spawn missing record items for an entire project. Idempotent —
 * existing rows whose `sourceTemplateRequirementId` already covers a
 * (service, requirement, partner) tuple are not duplicated.
 */
export async function spawnRecordItemsForProject(
  projectId: string
): Promise<SpawnSummary> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      clientId: true,
      services: {
        where: { deletedAt: null },
        select: { id: true, serviceTemplateId: true },
      },
      partners: { select: { id: true } },
    },
  });
  if (!project) return { spawned: 0, reused: 0, skipped: 0 };

  let spawned = 0;
  let reused = 0;
  let skipped = 0;

  for (const service of project.services) {
    if (!service.serviceTemplateId) {
      skipped++;
      continue;
    }
    const requirements = await prisma.serviceTemplateRequirement.findMany({
      where: { serviceTemplateId: service.serviceTemplateId },
      include: { documentType: true },
      orderBy: { order: "asc" },
    });
    for (const req of requirements) {
      const isPerPartner = req.isPerPartner || !!req.documentType?.isPerPartner;
      const partnerIds = isPerPartner
        ? project.partners.map((p) => p.id)
        : [null];
      // Per-partner with no partners yet: nothing to do today; the
      // partner-add flow will fill these in.
      if (isPerPartner && partnerIds.length === 0) {
        skipped++;
        continue;
      }

      for (const partnerId of partnerIds) {
        const created = await spawnOneIfMissing({
          projectId: project.id,
          clientId: project.clientId,
          serviceId: service.id,
          partnerId,
          requirementId: req.id,
          documentTypeId: req.documentTypeId,
          kind: req.kind,
          label: req.label,
          description: req.description,
        });
        if (created === "spawned") spawned++;
        else if (created === "reused") reused++;
        else skipped++;
      }
    }
  }
  return { spawned, reused, skipped };
}

/**
 * Spawn per-partner record items for a freshly-added partner. Walks
 * every service of the project and adds one item per requirement that
 * is `isPerPartner`. Idempotent.
 */
export async function spawnRecordItemsForPartner(
  projectId: string,
  partnerId: string
): Promise<SpawnSummary> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      clientId: true,
      services: {
        where: { deletedAt: null },
        select: { id: true, serviceTemplateId: true },
      },
    },
  });
  if (!project) return { spawned: 0, reused: 0, skipped: 0 };

  let spawned = 0;
  let reused = 0;
  let skipped = 0;

  for (const service of project.services) {
    if (!service.serviceTemplateId) continue;
    const requirements = await prisma.serviceTemplateRequirement.findMany({
      where: { serviceTemplateId: service.serviceTemplateId },
      include: { documentType: true },
      orderBy: { order: "asc" },
    });
    for (const req of requirements) {
      const isPerPartner = req.isPerPartner || !!req.documentType?.isPerPartner;
      if (!isPerPartner) continue;
      const created = await spawnOneIfMissing({
        projectId: project.id,
        clientId: project.clientId,
        serviceId: service.id,
        partnerId,
        requirementId: req.id,
        documentTypeId: req.documentTypeId,
        kind: req.kind,
        label: req.label,
        description: req.description,
      });
      if (created === "spawned") spawned++;
      else if (created === "reused") reused++;
      else skipped++;
    }
  }
  return { spawned, reused, skipped };
}

interface SpawnOneArgs {
  projectId: string;
  clientId: string;
  serviceId: string;
  partnerId: string | null;
  requirementId: string;
  documentTypeId: string | null;
  kind: "DOCUMENT" | "PLATFORM_ACCOUNT" | "SENSITIVE_DATA" | "NOTE" | "ISSUE" | "PLATFORM_LINK";
  label: string;
  description: string | null;
}

async function spawnOneIfMissing(
  args: SpawnOneArgs
): Promise<"spawned" | "reused" | "skipped"> {
  // Already-spawned guard. We pin via sourceTemplateRequirementId +
  // serviceId + partnerId so re-running the spawner is safe.
  const existing = await prisma.projectRecordItem.findFirst({
    where: {
      projectId: args.projectId,
      serviceId: args.serviceId,
      partnerId: args.partnerId,
      sourceTemplateRequirementId: args.requirementId,
      deletedAt: null,
    },
    select: { id: true },
  });
  if (existing) return "skipped";

  // Reuse: a CLIENT-scoped APPROVED row for this DocType on any of the
  // client's projects means the document is already in hand and we
  // shouldn't spawn another MISSING placeholder.
  if (args.documentTypeId) {
    const reuse = await prisma.projectRecordItem.findFirst({
      where: {
        documentTypeId: args.documentTypeId,
        status: "APPROVED",
        deletedAt: null,
        scope: "CLIENT",
        project: { clientId: args.clientId },
      },
      select: { id: true },
    });
    if (reuse) return "reused";
  }

  await prisma.projectRecordItem.create({
    data: {
      kind: args.kind,
      scope: "PROJECT",
      status: "MISSING",
      title: args.label,
      description: args.description,
      projectId: args.projectId,
      serviceId: args.serviceId,
      partnerId: args.partnerId,
      documentTypeId: args.documentTypeId,
      sourceTemplateRequirementId: args.requirementId,
      visibility: "EXECUTORS_AND_ADMIN",
    },
  });
  return "spawned";
}

// ─────────────────────────────────────────────────────────────────
// Completion guards
// ─────────────────────────────────────────────────────────────────

export interface MissingRecordItem {
  id: string;
  title: string;
  status: string;
  kind: string;
  partnerId: string | null;
  partner: { partnerNumber: number; name: string | null } | null;
  serviceId: string | null;
  service: { name: string } | null;
}

/**
 * Returns required project record items that aren't APPROVED yet.
 * Used by the project-close guard. An item is "required" when its
 * source ServiceTemplateRequirement.isRequired is true (which is the
 * default).
 */
export async function getMissingProjectRecordItems(
  projectId: string
): Promise<MissingRecordItem[]> {
  const items = await prisma.projectRecordItem.findMany({
    where: {
      projectId,
      deletedAt: null,
      isObsolete: false,
      status: { in: ["MISSING", "PENDING_REVIEW", "REJECTED", "DRAFT", "EXPIRED"] },
      sourceTemplateRequirement: { isRequired: true },
    },
    include: {
      partner: { select: { partnerNumber: true, name: true } },
      service: { select: { name: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
  });
  return items.map((it) => ({
    id: it.id,
    title: it.title,
    status: it.status,
    kind: it.kind,
    partnerId: it.partnerId,
    partner: it.partner,
    serviceId: it.serviceId,
    service: it.service,
  }));
}

/**
 * Returns the linked record items for a task that aren't APPROVED yet.
 * Used by the task-completion guard. Only TaskRequirementLink rows
 * with `isRequired = true` block completion.
 */
export async function getBlockingTaskRecordLinks(taskId: string) {
  const links = await prisma.taskRequirementLink.findMany({
    where: { taskId, isRequired: true },
    include: {
      recordItem: {
        select: {
          id: true,
          title: true,
          status: true,
          kind: true,
          deletedAt: true,
          isObsolete: true,
        },
      },
    },
  });
  return links
    .filter((l) => {
      const ri = l.recordItem;
      if (!ri || ri.deletedAt || ri.isObsolete) return false;
      return ri.status !== "APPROVED";
    })
    .map((l) => ({
      linkId: l.id,
      recordItemId: l.recordItem.id,
      title: l.recordItem.title,
      status: l.recordItem.status,
      kind: l.recordItem.kind,
    }));
}

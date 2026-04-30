import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

// ═══════════════════════════════════════════════════════════════════════
// Dual-write — Phase B
// ═══════════════════════════════════════════════════════════════════════
// Mirror functions that copy legacy table writes into the unified
// record system. Each function:
//
//   - is idempotent (re-running on the same legacy id is a no-op).
//   - matches existing rows via the `[TAG:legacyId]` suffix in title
//     (same convention as scripts/migrate-to-record-system.ts so the
//     verify script keeps catching both migration and dual-write rows).
//   - swallows its own errors and logs a warning. The caller never
//     needs a try/catch — these are best-effort mirrors and must never
//     fail the legacy request they shadow.
//
// Tag prefixes:
//   PD  → ProjectDocument
//   DOC → Document (legacy compliance)
//   CD  → ClientDocument
//   TRV → TaskRequirementValue
//
// IMPORTANT: do NOT call these inside a Prisma transaction. They run
// after the legacy write commits — any failure here is non-fatal.

function tag(prefix: string, legacyId: string) {
  return `[${prefix}:${legacyId}]`;
}

type RecordStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "MISSING"
  | "EXPIRED"
  | "ARCHIVED";

function statusFromDocStatus(s: string): RecordStatus {
  switch (s) {
    case "APPROVED":
      return "APPROVED";
    case "REJECTED":
    case "RE_UPLOAD_REQUIRED":
      return "REJECTED";
    case "PENDING_REVIEW":
    default:
      return "PENDING_REVIEW";
  }
}

function statusFromDocumentStatus(s: string): RecordStatus {
  switch (s) {
    case "VALID":
    case "EXPIRING_SOON":
      return "APPROVED";
    case "EXPIRED":
      return "EXPIRED";
    case "PENDING_RENEWAL":
      return "PENDING_REVIEW";
    default:
      return "DRAFT";
  }
}

// ─────────────────────────────────────────────────────────────────
// ProjectDocument
// ─────────────────────────────────────────────────────────────────

export interface MirrorProjectDocumentInput {
  id: string;
  projectId: string;
  documentTypeId: string;
  fileUrl: string | null;
  textData: string | null;
  uploadedById: string | null;
  reviewedById: string | null;
  reviewedAt: Date | null;
  rejectionReason: string | null;
  uploadedOnBehalfOfClient: boolean;
  isSharedWithClient: boolean;
  partnerId: string | null;
  status: string;
  version: number;
}

export async function mirrorProjectDocumentCreate(
  doc: MirrorProjectDocumentInput
): Promise<void> {
  try {
    const t = tag("PD", doc.id);
    const existing = await prisma.projectRecordItem.findFirst({
      where: { projectId: doc.projectId, title: { contains: t } },
      select: { id: true },
    });
    if (existing) return; // idempotent — migration may have created it.

    const dt = await prisma.docType.findUnique({
      where: { id: doc.documentTypeId },
      select: { name: true },
    });
    const title = `${dt?.name ?? "مستند"} v${doc.version} ${t}`;

    await prisma.projectRecordItem.create({
      data: {
        kind: "DOCUMENT",
        scope: "PROJECT",
        status: statusFromDocStatus(doc.status),
        title,
        fileUrl: doc.fileUrl,
        textData: doc.textData,
        projectId: doc.projectId,
        partnerId: doc.partnerId,
        documentTypeId: doc.documentTypeId,
        uploadedById: doc.uploadedById,
        reviewedById: doc.reviewedById,
        reviewedAt: doc.reviewedAt,
        rejectionReason: doc.rejectionReason,
        uploadedOnBehalfOfClient: doc.uploadedOnBehalfOfClient,
        isSharedWithClient: doc.isSharedWithClient,
        visibility: doc.isSharedWithClient
          ? "CLIENT_AND_ADMIN"
          : "EXECUTORS_AND_ADMIN",
      },
    });
  } catch (err) {
    logger.warn("dual-write: mirrorProjectDocumentCreate failed", {
      legacyId: doc.id,
      error: (err as Error).message,
    });
  }
}

interface ProjectDocumentUpdateFields {
  status?: string;
  rejectionReason?: string | null;
  reviewedById?: string | null;
  reviewedAt?: Date | null;
  isSharedWithClient?: boolean;
  fileUrl?: string | null;
  textData?: string | null;
}

export async function mirrorProjectDocumentUpdate(
  legacyId: string,
  fields: ProjectDocumentUpdateFields
): Promise<void> {
  try {
    const t = tag("PD", legacyId);
    const target = await prisma.projectRecordItem.findFirst({
      where: { title: { contains: t }, deletedAt: null },
      select: { id: true },
    });
    if (!target) return; // mirror row not found — silently skip.

    const data: Record<string, unknown> = {};
    if (fields.status !== undefined) data.status = statusFromDocStatus(fields.status);
    if ("rejectionReason" in fields) data.rejectionReason = fields.rejectionReason;
    if ("reviewedById" in fields) data.reviewedById = fields.reviewedById;
    if ("reviewedAt" in fields) data.reviewedAt = fields.reviewedAt;
    if ("isSharedWithClient" in fields) {
      data.isSharedWithClient = !!fields.isSharedWithClient;
      data.visibility = fields.isSharedWithClient
        ? "CLIENT_AND_ADMIN"
        : "EXECUTORS_AND_ADMIN";
    }
    if ("fileUrl" in fields) data.fileUrl = fields.fileUrl;
    if ("textData" in fields) data.textData = fields.textData;

    if (Object.keys(data).length === 0) return;

    await prisma.projectRecordItem.update({
      where: { id: target.id },
      data,
    });
  } catch (err) {
    logger.warn("dual-write: mirrorProjectDocumentUpdate failed", {
      legacyId,
      error: (err as Error).message,
    });
  }
}

export async function mirrorProjectDocumentDelete(
  legacyId: string
): Promise<void> {
  try {
    const t = tag("PD", legacyId);
    const target = await prisma.projectRecordItem.findFirst({
      where: { title: { contains: t }, deletedAt: null },
      select: { id: true },
    });
    if (!target) return;
    await prisma.projectRecordItem.update({
      where: { id: target.id },
      data: { deletedAt: new Date() },
    });
  } catch (err) {
    logger.warn("dual-write: mirrorProjectDocumentDelete failed", {
      legacyId,
      error: (err as Error).message,
    });
  }
}

// ─────────────────────────────────────────────────────────────────
// Document (legacy compliance)
// ─────────────────────────────────────────────────────────────────

export interface MirrorDocumentInput {
  id: string;
  title: string;
  fileUrl: string | null;
  ownerId: string;
  expiryDate: Date | null;
  reminderDays: number | null;
  status: string;
  notes: string | null;
}

export async function mirrorDocumentCreate(
  doc: MirrorDocumentInput
): Promise<void> {
  try {
    if (!doc.fileUrl) return; // nothing to mirror without a file.

    // Document is owned by a User, not a Project. Mirror requires a
    // project anchor — pick the owner's most recent active project.
    const ownerProject = await prisma.project.findFirst({
      where: { clientId: doc.ownerId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (!ownerProject) return; // no project to anchor onto — skip.

    const t = tag("DOC", doc.id);
    const existing = await prisma.projectRecordItem.findFirst({
      where: { projectId: ownerProject.id, title: { contains: t } },
      select: { id: true },
    });
    if (existing) return;

    await prisma.projectRecordItem.create({
      data: {
        kind: "DOCUMENT",
        scope: "COMPLIANCE",
        status: statusFromDocumentStatus(doc.status),
        title: `${doc.title} ${t}`,
        description: doc.notes,
        fileUrl: doc.fileUrl,
        expiryDate: doc.expiryDate,
        reminderDays: doc.reminderDays,
        projectId: ownerProject.id,
        uploadedById: doc.ownerId,
        visibility: "ADMIN_ONLY",
      },
    });
  } catch (err) {
    logger.warn("dual-write: mirrorDocumentCreate failed", {
      legacyId: doc.id,
      error: (err as Error).message,
    });
  }
}

// ─────────────────────────────────────────────────────────────────
// ClientDocument
// ─────────────────────────────────────────────────────────────────

export interface MirrorClientDocumentInput {
  id: string;
  clientId: string;
  title: string;
  fileUrl: string;
  uploadedById: string;
}

export async function mirrorClientDocumentCreate(
  doc: MirrorClientDocumentInput
): Promise<void> {
  try {
    const ownerProject = await prisma.project.findFirst({
      where: { clientId: doc.clientId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (!ownerProject) return;

    const t = tag("CD", doc.id);
    const existing = await prisma.projectRecordItem.findFirst({
      where: { projectId: ownerProject.id, title: { contains: t } },
      select: { id: true },
    });
    if (existing) return;

    await prisma.projectRecordItem.create({
      data: {
        kind: "DOCUMENT",
        scope: "CLIENT",
        status: "APPROVED",
        title: `${doc.title} ${t}`,
        fileUrl: doc.fileUrl,
        projectId: ownerProject.id,
        uploadedById: doc.uploadedById,
        isSharedWithClient: true,
        visibility: "CLIENT_AND_ADMIN",
      },
    });
  } catch (err) {
    logger.warn("dual-write: mirrorClientDocumentCreate failed", {
      legacyId: doc.id,
      error: (err as Error).message,
    });
  }
}

export async function mirrorClientDocumentDelete(
  legacyId: string
): Promise<void> {
  try {
    const t = tag("CD", legacyId);
    const target = await prisma.projectRecordItem.findFirst({
      where: { title: { contains: t }, deletedAt: null },
      select: { id: true },
    });
    if (!target) return;
    await prisma.projectRecordItem.update({
      where: { id: target.id },
      data: { deletedAt: new Date() },
    });
  } catch (err) {
    logger.warn("dual-write: mirrorClientDocumentDelete failed", {
      legacyId,
      error: (err as Error).message,
    });
  }
}

// ─────────────────────────────────────────────────────────────────
// TaskRequirementValue
// ─────────────────────────────────────────────────────────────────

export interface MirrorTaskRequirementValueInput {
  id: string;
  taskId: string;
  fileUrl: string | null;
  requirement: { label: string; isRequired: boolean } | null;
  task: {
    projectId: string | null;
    serviceId: string | null;
    assigneeId: string | null;
  };
}

export async function mirrorTaskRequirementValueUpsert(
  v: MirrorTaskRequirementValueInput
): Promise<void> {
  try {
    if (!v.fileUrl) return;
    if (!v.task.projectId) return;

    const t = tag("TRV", v.id);
    const existing = await prisma.projectRecordItem.findFirst({
      where: { projectId: v.task.projectId, title: { contains: t } },
      select: { id: true, fileUrl: true },
    });

    let recordItemId: string;
    if (existing) {
      // Update fileUrl if it changed (executor re-uploaded).
      if (existing.fileUrl !== v.fileUrl) {
        await prisma.projectRecordItem.update({
          where: { id: existing.id },
          data: { fileUrl: v.fileUrl },
        });
      }
      recordItemId = existing.id;
    } else {
      const created = await prisma.projectRecordItem.create({
        data: {
          kind: "DOCUMENT",
          scope: "TASK",
          status: "APPROVED",
          title: `${v.requirement?.label ?? "متطلّب مهمة"} ${t}`,
          fileUrl: v.fileUrl,
          projectId: v.task.projectId,
          serviceId: v.task.serviceId,
          uploadedById: v.task.assigneeId,
          visibility: "EXECUTORS_AND_ADMIN",
        },
      });
      recordItemId = created.id;
    }

    await prisma.taskRequirementLink.upsert({
      where: { taskId_recordItemId: { taskId: v.taskId, recordItemId } },
      create: {
        taskId: v.taskId,
        recordItemId,
        isRequired: !!v.requirement?.isRequired,
      },
      update: {},
    });
  } catch (err) {
    logger.warn("dual-write: mirrorTaskRequirementValueUpsert failed", {
      legacyId: v.id,
      error: (err as Error).message,
    });
  }
}

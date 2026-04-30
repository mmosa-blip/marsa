// ═══════════════════════════════════════════════════════════════════════
// Phase C — record-shape adapter
// ═══════════════════════════════════════════════════════════════════════
// Converts unified ProjectRecordItem rows back into the legacy shape
// each consumer expects (ProjectDocument / Document / ClientDocument).
//
// CRITICAL — id preservation:
//   Each mirrored row carries a `[TAG:legacyId]` suffix in its title,
//   written by both scripts/migrate-to-record-system.ts and the
//   record-dual-write helpers. The adapter extracts that legacy id and
//   returns it as the response's `id` field. This way:
//     - the UI sees the same ids it always saw,
//     - PATCH/DELETE on `/api/<resource>/[docId]` keep working against
//       the legacy table (which dual-write keeps in sync going forward),
//     - any new record-only items (created via the unified record API
//       without a legacy mirror) are skipped here — they live only in
//       the new system and surface only through /dashboard/.../record.
//
// Tag prefixes: PD (ProjectDocument), DOC (Document), CD (ClientDocument).

// We intentionally type the adapter input loosely — different callers
// `select` different field sets on documentType / partner / uploadedBy /
// reviewedBy, and constraining each property to the full Prisma type
// would force every caller to pull in fields they don't need. The
// adapter only reads the properties listed below; missing ones come
// back as `undefined` and the legacy shape carries them as null.

// ─────────────────────────────────────────────────────────────────
// Tag helpers
// ─────────────────────────────────────────────────────────────────

const TAG_RE: Record<string, RegExp> = {
  PD: /\[PD:([^\]]+)\]/,
  DOC: /\[DOC:([^\]]+)\]/,
  CD: /\[CD:([^\]]+)\]/,
  TRV: /\[TRV:([^\]]+)\]/,
};

const TAG_STRIP_RE = /\s*\[(?:PD|DOC|CD|TRV):[^\]]+\]\s*$/;
const VERSION_RE = /\sv(\d+)\s/;

export function extractLegacyId(
  prefix: "PD" | "DOC" | "CD" | "TRV",
  title: string
): string | null {
  const m = title.match(TAG_RE[prefix]);
  return m ? m[1] : null;
}

export function stripLegacyTag(title: string): string {
  return title.replace(TAG_STRIP_RE, "").replace(VERSION_RE, " ").trim();
}

function extractVersion(title: string): number {
  const m = title.match(VERSION_RE);
  return m ? parseInt(m[1], 10) || 1 : 1;
}

// ─────────────────────────────────────────────────────────────────
// Status mapping (new → legacy)
// ─────────────────────────────────────────────────────────────────

type LegacyDocStatus =
  | "PENDING_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "RE_UPLOAD_REQUIRED";

function recordStatusToDocStatus(s: string): LegacyDocStatus {
  switch (s) {
    case "APPROVED":
      return "APPROVED";
    case "REJECTED":
      return "REJECTED";
    case "MISSING":
    case "DRAFT":
    case "PENDING_REVIEW":
    default:
      return "PENDING_REVIEW";
  }
}

type LegacyDocumentStatus =
  | "VALID"
  | "EXPIRING_SOON"
  | "EXPIRED"
  | "PENDING_RENEWAL";

function recordStatusToDocumentStatus(
  s: string,
  expiry: Date | null
): LegacyDocumentStatus {
  if (s === "EXPIRED") return "EXPIRED";
  if (s === "PENDING_REVIEW" || s === "DRAFT" || s === "MISSING")
    return "PENDING_RENEWAL";
  if (expiry) {
    const now = Date.now();
    const exp = new Date(expiry).getTime();
    if (exp < now) return "EXPIRED";
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    if (exp - now <= thirtyDays) return "EXPIRING_SOON";
  }
  return "VALID";
}

// ─────────────────────────────────────────────────────────────────
// Adapter shapes
// ─────────────────────────────────────────────────────────────────

type RecordItemForAdapter = {
  id: string;
  title: string;
  status: string;
  fileUrl: string | null;
  textData: string | null;
  description?: string | null;
  expiryDate: Date | null;
  reminderDays: number | null;
  rejectionReason: string | null;
  reviewedAt: Date | null;
  uploadedOnBehalfOfClient?: boolean;
  isSharedWithClient?: boolean;
  createdAt: Date;
  updatedAt: Date;
  projectId: string;
  documentTypeId: string | null;
  uploadedById: string | null;
  reviewedById: string | null;
  partnerId: string | null;
  documentType?: { id: string; [k: string]: unknown } | null;
  partner?: { id: string; [k: string]: unknown } | null;
  uploadedBy?: { id: string; name: string } | null;
  reviewedBy?: { id: string; name: string } | null;
  project?: { id: string; name?: string; clientId?: string | null } | null;
};

// ─────────────────────────────────────────────────────────────────
// ProjectRecordItem → legacy ProjectDocument
// ─────────────────────────────────────────────────────────────────

export function recordItemToProjectDocument(
  item: RecordItemForAdapter
): Record<string, unknown> | null {
  const legacyId = extractLegacyId("PD", item.title);
  if (!legacyId) return null;

  const cleanTitle = stripLegacyTag(item.title);
  const version = extractVersion(item.title);

  return {
    id: legacyId,
    kind: item.fileUrl ? "FILE" : "TEXT",
    fileUrl: item.fileUrl,
    textData: item.textData,
    uploadedOnBehalfOfClient: item.uploadedOnBehalfOfClient ?? false,
    status: recordStatusToDocStatus(item.status),
    rejectionReason: item.rejectionReason,
    isSharedWithClient: item.isSharedWithClient ?? false,
    reviewedAt: item.reviewedAt,
    version,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    projectId: item.projectId,
    documentTypeId: item.documentTypeId,
    uploadedById: item.uploadedById,
    reviewedById: item.reviewedById,
    partnerId: item.partnerId,
    documentType: item.documentType ?? null,
    uploadedBy: item.uploadedBy ?? null,
    reviewedBy: item.reviewedBy ?? null,
    partner: item.partner ?? null,
    // Surfaced for callers that include `project` (e.g. shared route).
    project: item.project ?? undefined,
    // Pass through the cleaned title so any future callers that show it
    // get the human-readable version without the [PD:...] suffix.
    _cleanTitle: cleanTitle,
  };
}

// ─────────────────────────────────────────────────────────────────
// ProjectRecordItem → legacy Document (compliance)
// ─────────────────────────────────────────────────────────────────

export function recordItemToDocument(
  item: RecordItemForAdapter & { description?: string | null }
): Record<string, unknown> | null {
  const legacyId = extractLegacyId("DOC", item.title);
  if (!legacyId) return null;
  const cleanTitle = stripLegacyTag(item.title);

  return {
    id: legacyId,
    title: cleanTitle,
    type: "CUSTOM",
    customTypeName: null,
    documentNumber: null,
    issueDate: null,
    expiryDate: item.expiryDate,
    status: recordStatusToDocumentStatus(item.status, item.expiryDate),
    fileUrl: item.fileUrl,
    notes: item.description ?? null,
    reminderDays: item.reminderDays ?? 30,
    isLinkedToCompany: false,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    ownerId: item.uploadedById,
    companyId: null,
    company: null,
  };
}

// ─────────────────────────────────────────────────────────────────
// ProjectRecordItem → legacy ClientDocument
// ─────────────────────────────────────────────────────────────────

export function recordItemToClientDocument(
  item: RecordItemForAdapter
): Record<string, unknown> | null {
  const legacyId = extractLegacyId("CD", item.title);
  if (!legacyId) return null;
  const cleanTitle = stripLegacyTag(item.title);

  return {
    id: legacyId,
    clientId: item.project?.clientId ?? null,
    title: cleanTitle,
    fileUrl: item.fileUrl ?? "",
    fileType: null,
    uploadedById: item.uploadedById,
    createdAt: item.createdAt,
    uploadedBy: item.uploadedBy ?? null,
  };
}

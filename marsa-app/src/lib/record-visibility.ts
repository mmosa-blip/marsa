import type { Prisma } from "@/generated/prisma/client";

/**
 * Build a Prisma `where` fragment that scopes a record-item query to
 * what the current viewer is allowed to see.
 *
 * Rules (mirrors the existing project-document logic, generalised):
 *   - ADMIN / MANAGER             → empty fragment (sees everything).
 *   - CLIENT                      → items shared with them, items whose
 *                                   visibility is ALL/CLIENT_AND_ADMIN,
 *                                   or items they uploaded themselves.
 *                                   The caller MUST also verify that the
 *                                   client owns the project.
 *   - everyone else (executor /
 *     external_provider / finance /
 *     treasury / branch_manager)
 *                                 → items whose visibility is ALL or
 *                                   EXECUTORS_AND_ADMIN. ADMIN_ONLY items
 *                                   stay hidden.
 */
export function buildRecordVisibilityWhere(
  role: string,
  userId: string
): Prisma.ProjectRecordItemWhereInput {
  if (role === "ADMIN" || role === "MANAGER") return {};

  if (role === "CLIENT") {
    return {
      OR: [
        { isSharedWithClient: true },
        { visibility: { in: ["ALL", "CLIENT_AND_ADMIN"] } },
        { uploadedById: userId },
      ],
    };
  }

  return {
    visibility: { in: ["ALL", "EXECUTORS_AND_ADMIN"] },
  };
}

/**
 * Single-item permission check — used by the per-item routes that pull
 * a record by id and need to gate access. Returns true when the current
 * viewer is allowed to see this item under the same rules above.
 */
export function canViewRecordItem(args: {
  role: string;
  userId: string;
  projectClientId: string;
  item: {
    visibility: string;
    isSharedWithClient: boolean;
    uploadedById: string | null;
  };
}): boolean {
  const { role, userId, projectClientId, item } = args;
  if (role === "ADMIN" || role === "MANAGER") return true;
  if (role === "CLIENT") {
    if (projectClientId !== userId) return false;
    return (
      item.isSharedWithClient ||
      item.visibility === "ALL" ||
      item.visibility === "CLIENT_AND_ADMIN" ||
      item.uploadedById === userId
    );
  }
  return item.visibility === "ALL" || item.visibility === "EXECUTORS_AND_ADMIN";
}

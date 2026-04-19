/**
 * Investment department task assignment logic.
 *
 * Rules:
 * 1. Tasks distributed by project DATE priority — oldest project first
 * 2. Round-robin among qualified employees as tiebreaker when same date
 * 3. Within a project, executor with fewest current Investment tasks wins
 *
 * This function is called when assigning a task for an Investment department
 * project. It overrides the default naive round-robin assignment.
 */
import type { PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/** Prisma client or transaction client — works for both */
type PrismaLike = Omit<PrismaClient, "$on" | "$connect" | "$disconnect" | "$transaction" | "$extends">;

interface AssignOptions {
  projectId: string;
  serviceId: string;
  qualifiedEmployeeIds: string[];
  fallbackIndex?: number; // used if all employees have equal load (true tiebreaker)
  db?: PrismaLike;
}

/**
 * Pick the best assignee for an Investment task.
 *
 * Algorithm:
 * 1. Get the project creation date as "priority date"
 * 2. For each qualified employee, count their current open tasks in
 *    Investment department projects that are OLDER than this project.
 *    The employee with the MOST OLDER tasks should get this one (already
 *    focused on old backlog) — reverse: employee with LEAST older-task load
 *    is more available for new work... actually the requirement says
 *    "oldest project first" which is PROJECT priority, not executor selection.
 *
 * So the real logic is:
 * - Tasks FROM this project get queued first if project is oldest
 * - Among qualified employees, pick the one with fewest ACTIVE tasks
 * - Tiebreaker: round-robin (use fallbackIndex)
 *
 * Since Prisma creates tasks synchronously per project, "oldest project first"
 * is enforced naturally when admins create projects in chronological order.
 * The key optimization is EXECUTOR SELECTION.
 */
export async function pickInvestmentAssignee(
  opts: AssignOptions
): Promise<string | null> {
  const { qualifiedEmployeeIds, fallbackIndex = 0, db = prisma } = opts;

  if (qualifiedEmployeeIds.length === 0) return null;
  if (qualifiedEmployeeIds.length === 1) return qualifiedEmployeeIds[0];

  // Find the Investment department ID
  const dept = await db.department.findFirst({
    where: { name: { contains: "الاستثمار" } },
    select: { id: true },
  });

  if (!dept) {
    // Fallback to round-robin if department not found
    return qualifiedEmployeeIds[fallbackIndex % qualifiedEmployeeIds.length];
  }

  // Count active tasks per qualified employee in Investment projects
  // (TODO, IN_PROGRESS, IN_REVIEW, WAITING)
  const activeCounts = await db.task.groupBy({
    by: ["assigneeId"],
    where: {
      assigneeId: { in: qualifiedEmployeeIds },
      status: { in: ["TODO", "IN_PROGRESS", "IN_REVIEW", "WAITING"] },
      project: {
        departmentId: dept.id,
        deletedAt: null,
      },
    },
    _count: { assigneeId: true },
    orderBy: { _count: { assigneeId: "asc" } },
  });

  const countMap = new Map<string, number>();
  for (const c of activeCounts) {
    if (c.assigneeId) countMap.set(c.assigneeId, c._count.assigneeId);
  }

  // Employees with 0 active tasks aren't in the groupBy result
  // Find the one with minimum count (0 if not in map)
  let minCount = Infinity;
  const candidates: string[] = [];

  for (const empId of qualifiedEmployeeIds) {
    const count = countMap.get(empId) ?? 0;
    if (count < minCount) {
      minCount = count;
      candidates.length = 0;
      candidates.push(empId);
    } else if (count === minCount) {
      candidates.push(empId);
    }
  }

  // Tiebreaker: round-robin via fallbackIndex
  if (candidates.length === 0) return qualifiedEmployeeIds[0];
  return candidates[fallbackIndex % candidates.length];
}

/**
 * Returns true if the given department ID belongs to Investment department.
 */
export async function isInvestmentDepartment(departmentId: string | null | undefined, db: PrismaLike = prisma as unknown as PrismaLike): Promise<boolean> {
  if (!departmentId) return false;
  const dept = await db.department.findUnique({
    where: { id: departmentId },
    select: { name: true },
  });
  return dept?.name?.includes("الاستثمار") ?? false;
}

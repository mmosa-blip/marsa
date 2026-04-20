import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { can } from "./permissions";

/**
 * Unified auth helpers for API route handlers. Each helper throws a
 * `Response` object on failure — handlers catch it with:
 *
 *   try {
 *     const session = await requireRole(["ADMIN"]);
 *     // ...happy path...
 *   } catch (e) {
 *     if (e instanceof Response) return e;
 *     throw e;
 *   }
 *
 * Throwing a Response lets the happy path stay linear instead of
 * sprinkling `if (!session) return 401` at the top of every handler.
 * Middleware already rejects anonymous /api/* requests with 401 — these
 * helpers are the second line of defense and the place where role /
 * permission gating lives.
 */

export type UserRole =
  | "ADMIN"
  | "MANAGER"
  | "BRANCH_MANAGER"
  | "EXECUTOR"
  | "EXTERNAL_PROVIDER"
  | "CLIENT"
  | "FINANCE_MANAGER"
  | "TREASURY_MANAGER";

function unauthorized(): Response {
  return new Response(
    JSON.stringify({ error: "Unauthorized", message: "يجب تسجيل الدخول" }),
    { status: 401, headers: { "Content-Type": "application/json" } }
  );
}

function forbidden(): Response {
  return new Response(
    JSON.stringify({ error: "Forbidden", message: "ليست لديك صلاحية" }),
    { status: 403, headers: { "Content-Type": "application/json" } }
  );
}

export async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw unauthorized();
  return session;
}

export async function requireRole(roles: UserRole[]) {
  const session = await requireAuth();
  const userRole = session.user.role as UserRole;
  if (!roles.includes(userRole)) throw forbidden();
  return session;
}

export async function requirePermission(permission: string) {
  const session = await requireAuth();
  const user = session.user;
  const allowed = await can(user.id, user.role, permission);
  if (!allowed) throw forbidden();
  return session;
}

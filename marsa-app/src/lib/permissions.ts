import { prisma } from "./prisma";

// Simple in-memory cache with 30s TTL
const permCache = new Map<string, { keys: string[]; exp: number }>();

export async function getUserPermissions(userId: string): Promise<string[]> {
  const cached = permCache.get(userId);
  if (cached && cached.exp > Date.now()) return cached.keys;

  const records = await prisma.userPermission.findMany({
    where: {
      userId,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    include: { permission: true },
  });

  const keys = records.map((r) => r.permission.key);
  permCache.set(userId, { keys, exp: Date.now() + 30000 });
  return keys;
}

export function invalidatePermCache(userId: string) {
  permCache.delete(userId);
}

export async function can(userId: string, role: string, key: string): Promise<boolean> {
  if (role === "ADMIN") return true;
  if (role === "MANAGER") return true;
  const perms = await getUserPermissions(userId);
  return perms.includes(key);
}

export async function hasPermission(userId: string, key: string): Promise<boolean> {
  const perms = await getUserPermissions(userId);
  return perms.includes(key);
}

export const PERMISSIONS = {
  // Projects
  PROJECTS_VIEW: "projects.view",
  PROJECTS_CREATE: "projects.create",
  PROJECTS_EDIT: "projects.edit",
  PROJECTS_DELETE: "projects.delete",
  // Tasks
  TASKS_VIEW: "tasks.view",
  TASKS_UPDATE_STATUS: "tasks.update_status",
  TASKS_TRANSFER: "tasks.transfer",
  TASKS_ASSIGN: "tasks.assign",
  // Contracts
  CONTRACTS_VIEW: "contracts.view",
  CONTRACTS_CREATE: "contracts.create",
  CONTRACTS_APPROVE: "contracts.approve",
  CONTRACTS_DELETE: "contracts.delete",
  CONTRACTS_TEMPLATES: "contracts.templates",
  // Clients
  CLIENTS_VIEW: "clients.view",
  CLIENTS_CREATE: "clients.create",
  CLIENTS_EDIT: "clients.edit",
  CLIENTS_DELETE: "clients.delete",
  // Finance
  FINANCE_VIEW: "finance.view",
  FINANCE_CASHIER: "finance.cashier",
  FINANCE_INSTALLMENTS: "finance.installments",
  FINANCE_APPROVE: "finance.approve",
  FINANCE_EXPENSES: "finance.expenses",
  // Users
  USERS_VIEW: "users.view",
  USERS_CREATE: "users.create",
  USERS_EDIT: "users.edit",
  USERS_DELETE: "users.delete",
  USERS_PERMISSIONS: "users.permissions",
  // Tickets
  TICKETS_VIEW: "tickets.view",
  TICKETS_MANAGE: "tickets.manage",
  TICKETS_ASSIGN: "tickets.assign",
  // Reports
  REPORTS_VIEW: "reports.view",
  REPORTS_TIME: "reports.time",
  REPORTS_FINANCIAL: "reports.financial",
  // Settings
  SETTINGS_VIEW: "settings.view",
  SETTINGS_EDIT: "settings.edit",
} as const;

export const DEFAULT_EXECUTOR_PERMISSIONS = [
  "tasks.view",
  "tasks.update_status",
  "tasks.transfer",
  "projects.view",
  "projects.create",
  "clients.view",
  "tickets.view",
];

export const DEFAULT_BRANCH_MANAGER_PERMISSIONS = [
  "projects.view",
  "tasks.view",
  "users.view",
  "clients.view",
  "tickets.view",
];

export const DEFAULT_MANAGER_PERMISSIONS = [
  "projects.view", "projects.create", "projects.edit",
  "contracts.view", "contracts.create", "contracts.approve",
  "contracts.templates",
  "clients.view", "clients.create", "clients.edit",
  "finance.view", "finance.cashier", "finance.installments",
  "tasks.view", "tasks.update_status", "tasks.transfer", "tasks.assign",
  "tickets.view", "tickets.manage", "tickets.assign",
  "reports.view", "reports.time", "reports.financial",
  "users.view", "users.create", "users.edit",
];

export async function assignDefaultPermissions(
  userId: string,
  role: string,
  grantedById: string
) {
  let defaultKeys: string[] = [];
  if (role === "EXECUTOR" || role === "EXTERNAL_PROVIDER") {
    defaultKeys = DEFAULT_EXECUTOR_PERMISSIONS;
  } else if (role === "MANAGER") {
    defaultKeys = DEFAULT_MANAGER_PERMISSIONS;
  } else if (role === "BRANCH_MANAGER") {
    defaultKeys = DEFAULT_BRANCH_MANAGER_PERMISSIONS;
  }
  if (defaultKeys.length === 0) return;

  const perms = await prisma.permission.findMany({
    where: { key: { in: defaultKeys } },
  });

  if (perms.length > 0) {
    await prisma.userPermission.createMany({
      data: perms.map((p) => ({
        userId,
        permissionId: p.id,
        grantedById,
      })),
      skipDuplicates: true,
    });
  }
}

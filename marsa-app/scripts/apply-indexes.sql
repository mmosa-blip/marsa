-- ============================================================
-- MARSA — Composite indexes for common query patterns
-- Author:   Migration tooling, 2026-04-21
-- Purpose:  Back the @@index declarations added to prisma/schema.prisma
--           in commit 944caac. Prisma's own `db push` would LOCK TABLE
--           while creating each index; CONCURRENTLY avoids that so the
--           app keeps serving during the migration.
--
-- ⚠ RUN ONCE MANUALLY via the Supabase SQL editor (or psql). Do NOT
--   invoke `prisma db push` — it would recreate without CONCURRENTLY
--   and can stall the app for minutes on the bigger tables.
--
-- Safe to re-run: every CREATE uses IF NOT EXISTS.
-- Partial indexes (WHERE "deletedAt" IS NULL, etc.) keep the on-disk
-- footprint small and match the query shape our APIs use — the planner
-- picks a partial index over a full one when it knows the predicate
-- is always present.
-- ============================================================

-- ── users ────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_users_role_active"
  ON "users" ("role", "isActive", "deletedAt");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_users_supervisor_active"
  ON "users" ("supervisorUserId", "isActive")
  WHERE "supervisorUserId" IS NOT NULL;

ANALYZE "users";

-- ── services ─────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_services_project_deleted"
  ON "services" ("projectId", "deletedAt")
  WHERE "projectId" IS NOT NULL;

ANALYZE "services";

-- ── projects ─────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_projects_client_status"
  ON "projects" ("clientId", "status")
  WHERE "deletedAt" IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_projects_department_status"
  ON "projects" ("departmentId", "status")
  WHERE "deletedAt" IS NULL AND "departmentId" IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_projects_deleted_status"
  ON "projects" ("deletedAt", "status");

ANALYZE "projects";

-- ── tasks ────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_tasks_assignee_status"
  ON "tasks" ("assigneeId", "status")
  WHERE "deletedAt" IS NULL AND "assigneeId" IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_tasks_project_deleted"
  ON "tasks" ("projectId", "deletedAt")
  WHERE "projectId" IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_tasks_service_status"
  ON "tasks" ("serviceId", "status")
  WHERE "deletedAt" IS NULL AND "serviceId" IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_tasks_due_status"
  ON "tasks" ("dueDate", "status")
  WHERE "deletedAt" IS NULL AND "dueDate" IS NOT NULL;

ANALYZE "tasks";

-- ── audit_logs ───────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_audit_user_created"
  ON "audit_logs" ("userId", "createdAt" DESC)
  WHERE "userId" IS NOT NULL;

ANALYZE "audit_logs";

-- ============================================================
-- VERIFICATION (optional): after running the above, confirm the
-- indexes are live by querying pg_indexes:
--
--   SELECT schemaname, tablename, indexname
--   FROM pg_indexes
--   WHERE indexname LIKE 'idx_%'
--   ORDER BY tablename, indexname;
-- ============================================================

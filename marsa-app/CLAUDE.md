# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Marsa is an Arabic (RTL) business management system for a Saudi consultancy. It centralizes clients, projects, contracts, tasks, finance, and document management across departments — with a special "Investment" department that has its own task-distribution and document workflows.

Stack: **Next.js 16** (App Router) + **React 19** + **TypeScript** + **Prisma 7** with **PostgreSQL (Supabase)** + **NextAuth v4** (phone-based credentials) + **Tailwind v4** + **next-intl** + **Pusher** + **UploadThing**.

## Commands

```bash
npm run dev        # Next.js dev server
npm run build      # prisma generate && next build
npm run start      # next start (uses server.js / standalone)
npm run lint       # eslint
npm run seed       # tsx prisma/seed.ts (main seed)

# Prisma — note: Prisma 7 reads DATABASE_URL from prisma.config.ts (not the schema datasource)
npx prisma generate
npx prisma db push                  # Use the DIRECT connection (port 5432), not the pooler
npx prisma migrate dev --name foo

# Run any one-off TS script
npx tsx scripts/<file>.ts
npx tsx prisma/<seed-file>.ts
```

There is **no test runner configured** in this repo.

### TypeScript check before pushing

The user's standing rule: always run `npx tsc --noEmit` before committing. Build/lint errors block deploys on Hostinger.

## Database connection — Supabase specifics

- Runtime queries use the **Supabase pooler on port 6543** with `?pgbouncer=true`. This is what `DATABASE_URL` points to in `.env.production`.
- DDL operations (`prisma db push`, `prisma migrate`) **do not work through the pooler** — use the direct connection on port 5432 instead.
- The password contains `@` which **must be URL-encoded** as `%40` in the connection string.
- Prisma client is created via `PrismaPg` adapter (`@prisma/adapter-pg`), not Prisma's built-in driver. See `src/lib/prisma.ts` and `scripts/db.ts`.
- The Prisma client is **lazily instantiated through a Proxy** in `src/lib/prisma.ts` to avoid eager connections at module load and to share a singleton across hot reloads. Do not import `PrismaClient` directly elsewhere — always `import { prisma } from "@/lib/prisma"`.
- Prisma client is generated to `src/generated/prisma/` (custom output path), so `import { PrismaClient } from "@/generated/prisma/client"`.

## Architecture

### App Router layout (`src/app/`)

- `auth/` — login/register (phone-based)
- `dashboard/` — authenticated app shell. The dashboard renders one of four role-specific top-level components based on `session.user.role`: `AdminDashboard`, `EmployeeDashboard`, `ClientDashboard`, `ProviderDashboard`.
- `dashboard/layout.tsx` — wires sidebar, fires fire-and-forget calls like `/api/contracts/check-expiry` for ADMINs once per session.
- `api/` — REST endpoints. Pattern: each entity has its own folder; admin-only endpoints live under `api/admin/`; "current user" endpoints use the `my-*` prefix (`my-tasks`, `my-projects`, `my-documents`, etc.).

### Roles

`Role` enum: `ADMIN`, `MANAGER`, `CLIENT`, `EXECUTOR`, `EXTERNAL_PROVIDER`, `FINANCE_MANAGER`, `TREASURY_MANAGER`. The sidebar, dashboard view, and most API authorization branch on this. `EXECUTOR`s have a stripped-down sidebar with no department sections.

Admins can **impersonate** other users via an `impersonate_user_id` cookie; the JWT callback in `src/lib/auth.ts` swaps the session identity when this cookie is present. Always honor `session.user.id` after the callback (it already reflects impersonation).

### Authentication (`src/lib/auth.ts`)

NextAuth Credentials provider keyed on **Saudi phone number** (normalized via `normalizeSaudiPhone`), not email. Email is nullable on `User`. The JWT callback re-reads `role` and `name` from the database on every request so admin role changes take effect immediately.

When a fresh `EXECUTOR` / `EXTERNAL_PROVIDER` / `MANAGER` logs in with zero `UserPermission` rows, the callback seeds a default permission set. Keep these default-permission lists in sync with new permission keys.

### Permissions

Two-layer model: the `Role` enum gates broad capabilities, and `Permission` + `UserPermission` rows gate fine-grained actions (e.g. `tasks.transfer`, `contracts.approve`). Seed permissions live in `scripts/seed-permissions.ts`.

### Domain modules (where to look)

- **Projects/services/tasks** — `prisma/schema.prisma` models `Project`, `Service`, `ServiceTemplate`, `Task`, `TaskTemplate`, `ProjectTemplate`, `ProjectTemplateService`. Project instantiation from a template lives in `src/lib/project-instantiation.ts`.
- **Task assignment** — `src/lib/task-assignment.ts` (single-assignee model with accept/reject + 2-hour stale auto-reassign). Investment department has its own distribution logic in `src/lib/investment-assign.ts` (date priority + load balancing + round-robin tiebreaker). Generic auto-assign for other departments is in `src/lib/auto-assign.ts`.
- **Contracts** — schema model `Contract` supports both *template-generated* contracts (`templateId` set, `variables` + `finalContent` populated) and *uploaded existing* contracts (`templateId: null`, `uploadedFileUrl` set). Tracking fields: `startDate`, `endDate`, `durationDays`, `contractValue`. Endpoints: `/api/contracts`, `/api/contracts/standalone` (upload existing), `/api/contracts/expiring`, `/api/contracts/check-expiry`. UI: `ContractPromptDialog` (asks "هل يوجد عقد قائم؟" during project creation) and `ExpiringContractsWidget` (dashboard 30-day warning, with ≤15-day = critical).
- **Documents** — Investment-only document management. Models: `DocType` (note: renamed from `DocumentType` to avoid colliding with the existing enum of that name), `DocumentGroup`, `ProjectDocument`. Versioning + `shareWithClient` toggle.
- **Finance** — `Installment`, `Payment`, `PaymentRequest`, cashier flows under `dashboard/cashier/` and `api/cashier/`.
- **Opportunities** — DnD-kit Kanban under `dashboard/opportunities/`.
- **Notifications** — `src/lib/notifications.ts` + Pusher (`src/lib/pusher.ts`, `src/lib/pusher-client.ts`).
- **Audit log** — `src/lib/audit.ts`.

### Soft delete

Most user-facing models use `deletedAt` + `isActive`. Always filter on `deletedAt: null` (and usually `isActive: true`) in queries unless you're working with the recycle bin (`dashboard/recycle-bin/`).

### `@db.LongText` → `@db.Text`

The schema was migrated from MariaDB to PostgreSQL. Do not introduce `@db.LongText` — use `@db.Text` (PostgreSQL has no length distinction).

### Email uniqueness

`User.email` is **nullable**, so it cannot use `findUnique({ where: { email } })` directly when the value may be null. Use `findFirst` and combine with other constraints.

### Internationalization

`next-intl` is configured under `src/i18n/`. The app is Arabic/RTL by default; UI strings are in Arabic in the source (do not "translate" them in passing).

### Design system

`MarsaButton` is the canonical button component with 8 variants — prefer it over raw `<button>` or shadcn's `Button` when adding UI.

### PWA

`public/sw.js` is the service worker; `next.config.ts` adds `Cache-Control: no-store` headers for it. `scripts/generate-icons.ts` generates PWA icons.

## Seeds

`prisma/seed.ts` is the entry point declared in `package.json` and `prisma.config.ts`. Topical seeds live alongside it (`seed-departments.ts`, `seed-service-catalog.ts`, `seed-project-templates.ts`, `seed-clients-v2.ts`, etc.). The Investment-specific project template + 8 phases / 62 tasks is in `scripts/seed-investment-template.ts`. **Note**: when seeding tasks, do not use `prisma.task.createMany()` — it skips the `TaskAssignment` upserts that qualified employees rely on. Create tasks one at a time and explicitly upsert assignments.

`scripts/verify-seed.ts` prints counts + the Investment template breakdown — run it after any production seed.

## Deployment

Hostinger VPS, PM2 (`ecosystem.config.js`), Next.js `output: "standalone"`, custom `server.js`. The deploy script is `deploy.sh`. After deploys, the live `DATABASE_URL` env var must point at the Supabase pooler — a stale URL is the most common cause of "registration is broken in production but works locally".

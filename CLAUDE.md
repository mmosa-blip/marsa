# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Marsa** (مرسى) is a business services management platform built for Saudi Arabian companies. It manages projects, tasks, contracts, HR, finance, client documents, and service requests. The app is bilingual (Arabic primary, English secondary) with RTL-first layout.

## Tech Stack

- **Framework**: Next.js 16 (App Router) with React 19, TypeScript
- **Database**: MariaDB via Prisma 7 (driver adapter: `@prisma/adapter-mariadb`)
- **Auth**: NextAuth v4 with credentials provider (JWT strategy)
- **Styling**: Tailwind CSS v4, MarsaButton component system
- **Real-time**: Pusher (server + client)
- **File uploads**: UploadThing
- **Forms**: React Hook Form + Zod validation
- **State**: Zustand, React Context
- **Deployment**: Hostinger Node.js (standalone mode)

## Common Commands

All commands run from `marsa-app/`:

```bash
cd marsa-app
npm run dev          # Start dev server
npm run build        # prisma generate && next build
npm run lint         # ESLint
npm run seed         # npx tsx prisma/seed.ts
npx prisma generate  # Regenerate Prisma client (output: src/generated/prisma/)
npx prisma migrate dev --name <name>  # Create new migration (dev only)
```

### Production (see DEPLOY.md for full checklist)

```bash
bash deploy.sh                        # Safe deployment with backup
bash scripts/safe-migrate.sh          # Safe migration (uses migrate deploy)
bash scripts/backup-db.sh             # Database backup
npx tsx scripts/check-data.ts         # Verify production data
```

### NEVER on Production

- `npx prisma db push` — can drop tables
- `npx prisma migrate reset` — drops entire DB
- `npx tsx prisma/clear-db.ts` — permanently disabled

## Architecture

### Directory Structure (inside `marsa-app/`)

- `src/app/` — Next.js App Router pages and API routes
- `src/app/api/` — REST API routes (all server-side)
- `src/app/dashboard/` — Main authenticated UI, role-based dashboards
- `src/app/auth/` — Login/register pages
- `src/components/ui/MarsaButton.tsx` — Unified button design system (8 variants)
- `src/contexts/` — React contexts (LanguageContext, SidebarCountsContext)
- `src/i18n/` — Translation files (`ar.ts`, `en.ts`)
- `src/lib/` — Server/shared utilities
- `src/generated/prisma/` — Generated Prisma client (do not edit)
- `prisma/schema.prisma` — Database schema
- `scripts/` — Deployment, backup, and utility scripts

### Role System

Seven user roles: `ADMIN`, `MANAGER`, `CLIENT`, `EXECUTOR`, `EXTERNAL_PROVIDER`, `FINANCE_MANAGER`, `TREASURY_MANAGER`. ADMIN and MANAGER bypass permission checks. Others use a granular permission system (`src/lib/permissions.ts`) with `UserPermission` records. Permissions are dot-notation keys like `tasks.view`, `finance.cashier`.

### Department System

Four departments: Investment, Premium Residency, Real Estate, Services. Admin can add/edit/delete via `/dashboard/departments`. Departments link to projects, services, service templates, and tasks. Employees can belong to multiple departments via `UserDepartment` join table.

### Dashboard Routing

The dashboard layout (`src/app/dashboard/layout.tsx`) renders different sidebar navigation groups per role:
- **Admin/Manager**: Full access (projects, finance, HR, departments, settings, reports)
- **Executor**: Tasks, projects, transfers, cashier (filtered by permissions)
- **External Provider**: Tasks, payments, chat
- **Client**: Projects, services, documents, invoices, authorization, marketplace

### Key Patterns

- **Prisma client**: Lazy-initialized singleton in `src/lib/prisma.ts` using Proxy pattern. Always import from `@/lib/prisma`.
- **Auth checks in API routes**: Use `getServerSession(authOptions)` from `src/lib/auth.ts`. Session contains `user.id`, `user.role`.
- **Button component**: Use `<MarsaButton>` from `@/components/ui/MarsaButton` for all buttons. Variants: primary, gold, secondary, danger, dangerSoft, ghost, outline, link.
- **Soft delete**: Users are NEVER hard-deleted. Use `deletedAt` field. Tasks use CANCELLED status.
- **Protected users**: `src/lib/protected-users.ts` — admin account cannot be deleted.
- **Authorization**: Clients create/sign their own authorization at `/dashboard/my-authorization`. Admins can only view.
- **Notifications**: `src/lib/notifications.ts` creates DB records + pushes via Pusher.
- **Task auto-assignment**: `src/lib/auto-assign.ts` assigns tasks to providers based on `ServiceProviderMapping` priority.
- **i18n**: Client-side via `useLang()` hook from `LanguageContext`. Arabic is default.
- **Audit logging**: `src/lib/audit.ts` — tracks user actions including deletions.

### Database

Schema uses MySQL/MariaDB with Prisma. Generated client outputs to `src/generated/prisma/`. Key models: `User`, `Company`, `Project`, `Task`, `Service`, `ServiceTemplate`, `Department`, `Contract`, `Invoice`, `Payment`, `Ticket`, `Reminder`, `Document`, `Employee`.

### Safety Rules

- User deletion is always soft-delete (sets `deletedAt` + `isActive: false`)
- Admin account `m.mosa@bmarsa.com` is protected from deletion
- `clear-db.ts` is permanently disabled
- Recycle bin API at `/api/users/deleted` (30-day recovery)
- Always use `prisma migrate deploy` on production, never `db push`
- See `DEPLOY.md` for full deployment safety checklist

### Environment Variables

Database connection via `DATABASE_URL` (mysql:// format). `DATABASE_SSL=true` for TiDB dev. Auth via `NEXTAUTH_SECRET`, `NEXTAUTH_URL`. Pusher keys for real-time. UploadThing keys for file uploads.

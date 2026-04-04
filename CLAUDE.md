# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Marsa** (مرسى) is a business services management platform built for Saudi Arabian companies. It manages projects, tasks, contracts, HR, finance, client documents, and service requests. The app is bilingual (Arabic primary, English secondary) with RTL-first layout.

## Tech Stack

- **Framework**: Next.js 16 (App Router) with React 19, TypeScript
- **Database**: MariaDB via Prisma 7 (driver adapter: `@prisma/adapter-mariadb`)
- **Auth**: NextAuth v4 with credentials provider (JWT strategy)
- **Styling**: Tailwind CSS v4, shadcn/ui components
- **Real-time**: Pusher (server + client)
- **File uploads**: UploadThing
- **Forms**: React Hook Form + Zod validation
- **State**: Zustand, React Context
- **Deployment**: Vercel

## Common Commands

All commands run from `marsa-app/`:

```bash
cd marsa-app
npm run dev          # Start dev server
npm run build        # prisma generate && next build
npm run lint         # ESLint
npm run seed         # npx tsx prisma/seed.ts
npx prisma generate  # Regenerate Prisma client (output: src/generated/prisma/)
npx prisma db push   # Push schema to DB without migration
npx prisma migrate dev --name <name>  # Create migration
```

## Architecture

### Directory Structure (inside `marsa-app/`)

- `src/app/` — Next.js App Router pages and API routes
- `src/app/api/` — REST API routes (all server-side)
- `src/app/dashboard/` — Main authenticated UI, role-based dashboards
- `src/app/auth/` — Login/register pages
- `src/components/` — Shared React components
- `src/contexts/` — React contexts (LanguageContext, SidebarCountsContext)
- `src/i18n/` — Translation files (`ar.ts`, `en.ts`)
- `src/lib/` — Server/shared utilities
- `src/generated/prisma/` — Generated Prisma client (do not edit)
- `prisma/schema.prisma` — Database schema (~1500 lines)
- `prisma/seed*.ts` — Various seed scripts

### Role System

Seven user roles with cascading permissions: `ADMIN`, `MANAGER`, `CLIENT`, `EXECUTOR`, `EXTERNAL_PROVIDER`, `FINANCE_MANAGER`, `TREASURY_MANAGER`. ADMIN and MANAGER bypass permission checks. Others use a granular permission system (`src/lib/permissions.ts`) with `UserPermission` records in the database. Permissions are dot-notation keys like `tasks.view`, `finance.cashier`.

### Dashboard Routing

The dashboard layout (`src/app/dashboard/layout.tsx`) renders different sidebar navigation groups per role. Each role sees different nav items:
- **Admin/Manager**: Full access (projects, finance, HR, settings, reports)
- **Executor**: Tasks, projects, transfers, cashier (filtered by permissions)
- **External Provider**: Tasks, payments, chat
- **Client**: Projects, services, documents, invoices, marketplace

### Key Patterns

- **Prisma client**: Singleton in `src/lib/prisma.ts` using MariaDB driver adapter. Always import from `@/lib/prisma`.
- **Auth checks in API routes**: Use `getServerSession(authOptions)` from `src/lib/auth.ts`. Session contains `user.id`, `user.role`.
- **Admin impersonation**: Admins can impersonate users via cookies (`impersonate_user_id`). The JWT callback swaps session identity.
- **Notifications**: `src/lib/notifications.ts` creates DB records + pushes via Pusher.
- **Task auto-assignment**: `src/lib/auto-assign.ts` assigns tasks to providers based on `ServiceProviderMapping` priority.
- **i18n**: Client-side via `useLang()` hook from `LanguageContext`. Translations are static objects in `src/i18n/`. Arabic is the default language.
- **Audit logging**: `src/lib/audit.ts` — used for tracking user actions.
- **Contract PDF generation**: `src/lib/contract-pdf.ts` using jsPDF.

### Database

Schema uses MySQL/MariaDB with Prisma. The generated client outputs to `src/generated/prisma/` (not `node_modules`). Key models: `User`, `Company`, `Project`, `Task`, `Service`, `ServiceTemplate`, `Contract`, `Invoice`, `Payment`, `Ticket`, `Reminder`, `Document`, `Employee`.

### Environment Variables

Database connection via `DATABASE_URL` (mysql:// format). Auth via `NEXTAUTH_SECRET`, `NEXTAUTH_URL`. Pusher keys for real-time. UploadThing keys for file uploads.

# Deployment Guide — Marsa

Safe deployment checklist for Hostinger Node.js hosting.

## Pre-Deployment Checklist

- [ ] **Code tested locally** — `npm run build` succeeds
- [ ] **Database backup taken** — Either via `scripts/backup-db.sh` or Hostinger panel
- [ ] **No dangerous scripts modified** — `clear-db.ts` must remain disabled
- [ ] **Environment variables set** — All vars from `.env.example` configured in Hostinger panel
- [ ] **Git pushed** — All changes committed and pushed to GitHub

## Step-by-Step Deployment

### 1. Take a Database Backup

**Option A — Hostinger Panel (recommended):**
1. Go to Hostinger hPanel → Databases → MySQL
2. Click on your database → Backups → Create Backup

**Option B — Via SSH:**
```bash
cd ~/public_html
bash scripts/backup-db.sh
```

### 2. Pull Latest Code

```bash
cd ~/public_html
git pull origin main
```

### 3. Run Safe Deploy Script

```bash
bash deploy.sh
```

This script will:
1. Verify environment variables
2. Prompt for backup confirmation
3. Install dependencies
4. Generate Prisma client
5. Run `prisma migrate deploy` (safe, non-destructive)
6. Build Next.js
7. Prepare standalone server

### 4. Restart the Application

```bash
pm2 restart marsa
# or
pm2 start ecosystem.config.js
```

### 5. Verify

- Visit https://royalblue-mole-986649.hostingersite.com
- Login with admin account
- Check dashboard loads correctly

## Database Migrations

### Adding New Fields/Tables (safe)

1. Edit `prisma/schema.prisma`
2. Run locally: `npx prisma migrate dev --name description_of_change`
3. Commit the migration files in `prisma/migrations/`
4. On production: `npx prisma migrate deploy` (runs pending migrations)

### NEVER Do This on Production

| Command | Risk | Use Instead |
|---------|------|-------------|
| `npx prisma db push` | Can drop tables | `npx prisma migrate deploy` |
| `npx tsx prisma/clear-db.ts` | Deletes ALL data | Script is permanently disabled |
| `npx prisma migrate reset` | Drops entire DB | Never on production |
| `npx prisma db seed` | May overwrite data | Only for fresh DBs |

## Environment Variables

Set these in Hostinger hPanel → Website → Advanced → Node.js → Environment Variables:

```
DATABASE_URL=mysql://user:pass@host:3306/database
NEXTAUTH_URL=https://royalblue-mole-986649.hostingersite.com
NEXTAUTH_SECRET=<generated-secret>
UPLOADTHING_TOKEN=<token>
PUSHER_APP_ID=<id>
NEXT_PUBLIC_PUSHER_KEY=<key>
NEXT_PUBLIC_PUSHER_CLUSTER=<cluster>
PUSHER_SECRET=<secret>
```

## Hostinger Automatic Backups

1. Go to hPanel → Files → Backups
2. Enable **Daily Backups** (Hostinger keeps 7 days)
3. For database specifically: Databases → Backups → Enable auto-backup

## Emergency Recovery

### If deployment breaks the site:
```bash
# Revert to previous commit
git log --oneline -5
git checkout <previous-commit-hash> -- .
npm run build
pm2 restart marsa
```

### If data is lost:
1. Go to Hostinger panel → Databases → Backups
2. Restore the most recent backup
3. Or use the recycle bin API: `GET /api/users/deleted` (30-day window for users)

### Admin account locked out:
```bash
# Run from project root with DATABASE_URL set
npx tsx scripts/create-admin.ts
```

## Protected Resources

- **Admin account** `m.mosa@bmarsa.com` — Cannot be deleted via API (protected in code)
- **clear-db.ts** — Permanently disabled, exits with error
- **User deletion** — Always soft-delete (sets `deletedAt`, recoverable for 30 days)
- **Task deletion** — Sets status to CANCELLED instead of hard delete

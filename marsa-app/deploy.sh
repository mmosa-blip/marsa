#!/bin/bash
# ═══════════════════════════════════════════════════
# Marsa — Safe Production Deployment Script
# Run this on the Hostinger server
# ═══════════════════════════════════════════════════

set -e

echo "═══════════════════════════════════════════"
echo "  Marsa — Production Deployment"
echo "  $(date)"
echo "═══════════════════════════════════════════"

# ─── Pre-flight checks ───
echo ""
echo "🔍 Pre-flight checks..."

if [ ! -f .env.production ] && [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: .env.production file or DATABASE_URL env var required"
  exit 1
fi

echo "   ✓ Environment variables found"

# ─── Step 1: Backup database ───
echo ""
echo "📦 Step 1/6: Backing up database..."
if command -v mysqldump &> /dev/null || command -v mariadb-dump &> /dev/null; then
  bash scripts/backup-db.sh || echo "   ⚠️  Backup script failed — ensure you have a manual backup!"
else
  echo "   ⚠️  mysqldump not available on this server"
  echo "   → Take a manual backup from Hostinger panel BEFORE proceeding!"
  echo ""
  read -p "   Have you taken a backup? (y/N): " confirm
  if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo "❌ Deployment cancelled. Take a backup first."
    exit 1
  fi
fi

# ─── Step 2: Install dependencies ───
echo ""
echo "📦 Step 2/6: Installing dependencies..."
npm ci --production=false

# ─── Step 3: Generate Prisma client ───
echo ""
echo "⚙️  Step 3/6: Generating Prisma client..."
npx prisma generate

# ─── Step 4: Run migrations (SAFE — migrate deploy, NOT db push) ───
echo ""
echo "🔄 Step 4/6: Running database migrations..."
echo "   Using: prisma migrate deploy (safe, non-destructive)"
npx prisma migrate deploy || {
  echo ""
  echo "⚠️  migrate deploy failed."
  echo "   This may happen if migration history doesn't match."
  echo "   If this is a FIRST deployment, you may need 'prisma db push' once."
  echo ""
  read -p "   Fall back to 'prisma db push'? (y/N): " fallback
  if [ "$fallback" = "y" ] || [ "$fallback" = "Y" ]; then
    echo "   Running prisma db push..."
    npx prisma db push
  else
    echo "❌ Deployment cancelled at migration step."
    exit 1
  fi
}

# ─── Step 5: Build Next.js ───
echo ""
echo "🔨 Step 5/6: Building Next.js..."
npm run build

# ─── Step 6: Copy standalone files ───
echo ""
echo "📂 Step 6/6: Preparing standalone server..."
cp -r .next/static .next/standalone/.next/static 2>/dev/null || true
cp -r public .next/standalone/public 2>/dev/null || true

echo ""
echo "═══════════════════════════════════════════"
echo "  ✅ Deployment complete!"
echo "═══════════════════════════════════════════"
echo ""
echo "  Start: node .next/standalone/server.js"
echo "  PM2:   pm2 start ecosystem.config.js"
echo ""

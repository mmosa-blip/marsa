#!/bin/bash
# ═══════════════════════════════════════════════════
# Marsa — Safe Database Migration Script
# Uses 'migrate deploy' (NOT 'db push') for production
# Always backs up the database first
# ═══════════════════════════════════════════════════

set -e

echo "═══════════════════════════════════════════"
echo "  Marsa — Safe Database Migration"
echo "═══════════════════════════════════════════"

# Detect environment
if [ "$NODE_ENV" = "production" ] || [ -f .env.production ]; then
  ENV="PRODUCTION"
else
  ENV="DEVELOPMENT"
fi

echo "🌍 Environment: ${ENV}"

# Block db push on production
if [ "$1" = "push" ] && [ "$ENV" = "PRODUCTION" ]; then
  echo ""
  echo "⛔ BLOCKED: 'prisma db push' is FORBIDDEN on production."
  echo "   Use 'prisma migrate deploy' instead."
  echo "   Run: bash scripts/safe-migrate.sh"
  exit 1
fi

# Backup before migration (production only)
if [ "$ENV" = "PRODUCTION" ]; then
  echo ""
  echo "📦 Step 1: Creating database backup..."
  bash scripts/backup-db.sh || {
    echo "⚠️  Backup failed — continuing anyway (mysqldump may not be available)"
    echo "   Make sure you have a recent backup from Hostinger panel!"
    read -p "   Continue without backup? (y/N): " confirm
    if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
      echo "❌ Migration cancelled."
      exit 1
    fi
  }
fi

# Generate Prisma client
echo ""
echo "⚙️  Step 2: Generating Prisma client..."
npx prisma generate

# Run migration
echo ""
echo "🔄 Step 3: Running migration..."
if [ "$ENV" = "PRODUCTION" ]; then
  echo "   Using: prisma migrate deploy (safe, non-destructive)"
  npx prisma migrate deploy
else
  echo "   Using: prisma db push (dev only)"
  npx prisma db push
fi

echo ""
echo "✅ Migration complete!"

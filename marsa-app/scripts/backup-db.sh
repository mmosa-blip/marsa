#!/bin/bash
# ═══════════════════════════════════════════════════
# Marsa — Database Backup Script
# Run BEFORE any deployment or schema migration
# ═══════════════════════════════════════════════════

set -e

# Load env vars
if [ -f .env.production ]; then
  export $(grep -v '^#' .env.production | xargs)
elif [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL not set. Cannot backup."
  exit 1
fi

# Parse DATABASE_URL (mysql://user:pass@host:port/database)
DB_URL="${DATABASE_URL#mysql://}"
DB_USER="${DB_URL%%:*}"
DB_REST="${DB_URL#*:}"
DB_PASS="${DB_REST%%@*}"
DB_REST="${DB_REST#*@}"
DB_HOST="${DB_REST%%:*}"
DB_REST="${DB_REST#*:}"
DB_PORT="${DB_REST%%/*}"
DB_NAME="${DB_REST#*/}"
DB_NAME="${DB_NAME%%\?*}"

BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/marsa_backup_${TIMESTAMP}.sql"

mkdir -p "$BACKUP_DIR"

echo "🔄 Backing up database: ${DB_NAME}@${DB_HOST}"
echo "   Timestamp: ${TIMESTAMP}"

if command -v mysqldump &> /dev/null; then
  mysqldump \
    --host="$DB_HOST" \
    --port="$DB_PORT" \
    --user="$DB_USER" \
    --password="$DB_PASS" \
    --single-transaction \
    --routines \
    --triggers \
    "$DB_NAME" > "$BACKUP_FILE"

  FILESIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  echo "✅ Backup saved: ${BACKUP_FILE} (${FILESIZE})"

  # Keep only last 10 backups
  ls -t ${BACKUP_DIR}/marsa_backup_*.sql 2>/dev/null | tail -n +11 | xargs -r rm
  echo "🗂  Retained last 10 backups"
else
  echo "⚠️  mysqldump not found — attempting mariadb-dump..."
  if command -v mariadb-dump &> /dev/null; then
    mariadb-dump \
      --host="$DB_HOST" \
      --port="$DB_PORT" \
      --user="$DB_USER" \
      --password="$DB_PASS" \
      --single-transaction \
      "$DB_NAME" > "$BACKUP_FILE"
    echo "✅ Backup saved: ${BACKUP_FILE}"
  else
    echo "❌ Neither mysqldump nor mariadb-dump found."
    echo "   Install mariadb-client or use Hostinger panel for manual backup."
    exit 1
  fi
fi

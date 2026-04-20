#!/bin/bash
cd "$(dirname "$0")/.."
echo "=== APIs that query prisma.project without deletedAt filter ==="
for f in $(grep -rl "prisma\.project\." src/app/api --include="*.ts"); do
  hasQuery=$(grep -cE "prisma\.project\.(findMany|findFirst|findUnique|count)" "$f")
  hasFilter=$(grep -c "deletedAt" "$f")
  if [ "$hasQuery" -gt "0" ] && [ "$hasFilter" -eq "0" ]; then
    echo "NO FILTER: $f"
  fi
done

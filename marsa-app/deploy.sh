#!/bin/bash
# Marsa - Hostinger deployment script
# Run this on the Hostinger server after uploading the project

set -e

echo "=== Installing dependencies ==="
npm ci --production=false

echo "=== Generating Prisma client ==="
npx prisma generate

echo "=== Pushing database schema ==="
npx prisma db push

echo "=== Building Next.js ==="
npm run build

echo "=== Copying standalone files ==="
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public

echo "=== Done! ==="
echo "Start the app with: node .next/standalone/server.js"
echo "Or with PM2: pm2 start ecosystem.config.js"

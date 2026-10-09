#!/bin/sh
set -e

# Load DATABASE_URL from .env if present and not already set
if [ -z "$DATABASE_URL" ]; then
  if [ -f "/app/data/config/.env" ]; then
    export $(grep -v '^#' /app/data/config/.env | xargs)
  fi
fi

# Fallback default if still not set
export DATABASE_URL="${DATABASE_URL:-file:/app/data/sell_helper.db}"

echo "==> [Entrypoint] Synchronizing database schema (DATABASE_URL: $DATABASE_URL)..."
npx prisma db push --skip-generate

echo "==> [Entrypoint] Starting application..."
exec "$@"

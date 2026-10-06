#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
pkill -f "bun --watch src/main.ts" 2>/dev/null || true
pkill -f "vite --host" 2>/dev/null || true
docker compose -f docker/compose.dev.yml down >/dev/null 2>&1 || true
docker compose -f docker/compose.yml --profile docker stop app >/dev/null 2>&1 || true
echo "arcade (dev) stopped"
# Postgres keeps running; tear it down with: docker compose -f docker/compose.yml down

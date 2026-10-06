#!/usr/bin/env bash
# All-in-Docker hot reload (bind mounts + compose watch).
# Prefer `bun start` on the host when you can — native watch is faster.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

# free port 3000 / 5432 from baked or host-dev stacks
pkill -f "bun --watch src/main.ts" 2>/dev/null || true
pkill -f "vite --host" 2>/dev/null || true
docker compose -f docker/compose.yml --profile docker down >/dev/null 2>&1 || true
docker stop arcade-app-1 temp-battle-app-1 >/dev/null 2>&1 || true

echo "arcade (docker hot reload)"
echo "  UI   → http://127.0.0.1:5173   (Vite HMR — use this)"
echo "  API  → http://127.0.0.1:3000   (/api; / redirects to Vite)"
echo "  stop → Ctrl+C  or  bun stop:docker"

exec docker compose -f docker/compose.dev.yml up --remove-orphans

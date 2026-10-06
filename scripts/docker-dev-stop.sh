#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
docker compose -f docker/compose.dev.yml down --remove-orphans
echo "arcade (docker hot reload) stopped"

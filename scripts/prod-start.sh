#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ ! -f .env ]]; then
  echo "missing .env — copy .env.example and set prod values" >&2
  exit 1
fi
docker compose -f docker/compose.prod.yml --env-file .env up -d --build
echo "arcade (prod) → http://localhost:80"

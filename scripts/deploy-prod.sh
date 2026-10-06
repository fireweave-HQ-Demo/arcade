#!/usr/bin/env bash
# Fast EC2 prod deploy. Repo should already be on origin/main (workflow fetches first).
# Target: < 30s Actions wall-clock when image layers / fingerprint match.
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/temp-battle}"
cd "$APP_DIR"

dc() {
  sudo docker compose -f docker-compose.prod.yml --env-file .env "$@"
}

# Content fingerprint of build inputs (works with shallow clones)
fingerprint() {
  git ls-files -s -- \
    Dockerfile \
    package.json \
    bun.lock \
    server \
    client \
    docker-compose.prod.yml \
    | sha256sum | awk '{print $1}'
}

NEW="$(git rev-parse HEAD)"
FP="$(fingerprint)"
PREV_FP="$(cat .deploy-build-id 2>/dev/null || true)"

cat > .env <<EOF
POSTGRES_USER=${POSTGRES_USER}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=${POSTGRES_DB}
DATABASE_URL=${DATABASE_URL}
SESSION_SECRET=${SESSION_SECRET}
PORT=80
NODE_ENV=production
OPENOBSERVE_URL=${OPENOBSERVE_URL}
OPENOBSERVE_USER=${OPENOBSERVE_USER}
OPENOBSERVE_PASSWORD=${OPENOBSERVE_PASSWORD}
OPENOBSERVE_LOG_STREAM=${OPENOBSERVE_LOG_STREAM:-temp_battle_logs}
OPENOBSERVE_TRACE_STREAM=${OPENOBSERVE_TRACE_STREAM:-temp_battle_traces}
EOF

# Stop legacy dev stack (port 3000) if still running
sudo docker compose -f docker-compose.yml down --remove-orphans >/dev/null 2>&1 || true

NEED_BUILD=1
if [[ -n "${PREV_FP}" && "${PREV_FP}" == "${FP}" ]] \
  && sudo docker image inspect temp-battle-app:prod >/dev/null 2>&1; then
  NEED_BUILD=0
fi

export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

if [[ "${NEED_BUILD}" == "1" ]]; then
  echo "building app image…"
  dc build app
else
  echo "skip build (fingerprint unchanged)"
fi

dc up -d --remove-orphans --no-build

for _ in $(seq 1 40); do
  if curl -fsS --max-time 1 "http://127.0.0.1/api/health" >/dev/null 2>&1; then
    echo "${FP}" > .deploy-build-id
    echo "${NEW}" > .deploy-sha
    echo "healthy sha=${NEW} build=${NEED_BUILD}"
    exit 0
  fi
  sleep 0.5
done

echo "health check failed"
dc logs --tail=80 app
exit 1

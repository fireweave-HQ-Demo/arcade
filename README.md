# temp-battle

Lightweight **human vs bot** tic-tac-toe. Bun API + React UI + Postgres, all containerized.

## Commands

| Env | Start | Stop | URL |
|-----|-------|------|-----|
| **dev** | `bun start` / `./start` | `bun stop` | http://localhost:3000 |
| **prod** | `bun start:prod` / `./start.prod` | `bun stop:prod` | http://localhost:80 |

```bash
bun start        # docker-compose.yml        → :3000
bun start:prod   # docker-compose.prod.yml   → :80
```

## Stack

- **Bun** server (API + static SPA)
- **React** client
- **Postgres 16** (users, sessions, games)
- **OpenObserve** logs + metrics + traces on every API request
- Perfect-play bot via **minimax** (O always optimal)

## Compose files

- `docker-compose.yml` — local/dev, port **3000**
- `docker-compose.prod.yml` — production, port **80**, `NODE_ENV=production`, image tag `temp-battle-app:prod`

## Observability (OpenObserve)

| Signal | Stream / name | How |
|--------|---------------|-----|
| Logs | `temp_battle_logs` | JSON ingest `/{stream}/_json` |
| Metrics | `temp_battle_http_requests`, `temp_battle_http_duration_ms`, `temp_battle_events` | `/ingest/metrics/_json` |
| Traces | `temp_battle_traces` | OTLP/HTTP JSON `/v1/traces` |

```bash
curl -s http://localhost:3000/api/observability/verify | jq   # dev
curl -s http://localhost/api/observability/verify | jq        # prod
```

## Auth

HttpOnly cookie sessions (30 days) stored in Postgres — persistent login across reloads until logout or expiry.

## Local env

Copy `.env.example` → `.env`.

## Deploy (EC2)

Pushes / merges to `main` run [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) → `scripts/deploy-prod.sh`:

1. SSH + `git reset --hard origin/main`
2. Write prod `.env` (PORT=80)
3. **Skip image rebuild** when Dockerfile/deps/app sources unchanged
4. `docker compose -f docker-compose.prod.yml up -d`
5. Health check on `:80`

Warm deploys target **&lt; 30s** Actions wall-clock.

| Item | Value |
|------|--------|
| Host | `54.205.169.117` |
| User | `ubuntu` |
| App dir | `~/temp-battle` |
| URL | http://54.205.169.117 |

Open security group **TCP 80** (and 22 for deploy). Manual redeploy: Actions → **Deploy to EC2** → Run workflow.

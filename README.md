# temp-battle

Lightweight **human vs bot** tic-tac-toe. Bun API + React UI + Postgres, all containerized.

## One-line commands

```bash
bun start   # or ./start  → docker compose up -d --build
bun stop    # or ./stop   → docker compose down
```

Open [http://localhost:3000](http://localhost:3000).

## Stack

- **Bun** server (API + static SPA)
- **React** client
- **Postgres 16** (users, sessions, games)
- **OpenObserve** logs + metrics + traces on every API request
- Perfect-play bot via **minimax** (O always optimal)

## Observability (OpenObserve)

| Signal | Stream / name | How |
|--------|---------------|-----|
| Logs | `temp_battle_logs` | JSON ingest `/{stream}/_json` |
| Metrics | `temp_battle_http_requests`, `temp_battle_http_duration_ms`, `temp_battle_events` | ` /ingest/metrics/_json` |
| Traces | `temp_battle_traces` | OTLP/HTTP JSON `/v1/traces` |

Verify inject → fetch round-trip:

```bash
curl -s http://localhost:3000/api/observability/verify | jq
```

`ok: true` means a unique probe was written and then read back for logs + metrics, and traces ingest + stream presence succeeded (search may lag briefly on new streams).

## Auth

HttpOnly cookie sessions (30 days) stored in Postgres — persistent login across reloads/browser restarts until logout or expiry.

## Local env

Copy `.env.example` → `.env` (a working `.env` is already present for local use).

## Deploy (EC2)

Pushes / merges to `main` trigger [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml):

1. SSH to EC2
2. `git reset --hard origin/main`
3. Write `.env` from GitHub secrets
4. `docker compose up -d --build` (warm cache → usually a few seconds)

| Item | Value |
|------|--------|
| Host | `54.205.169.117` |
| User | `ubuntu` |
| App dir | `~/temp-battle` |
| URL | http://54.205.169.117:3000 |

GitHub secrets: `EC2_HOST`, `EC2_USER`, `EC2_SSH_KEY`, plus all app env vars from `.env.example`.

Manual redeploy: Actions → **Deploy to EC2** → Run workflow.

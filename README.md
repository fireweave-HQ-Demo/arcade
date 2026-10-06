# arcade

Multi-game **human vs bot** centre. Bun monorepo with clean-architecture API, pluggable engines, shared auth, cross-game scoreboard, admin popularity insights, and OpenObserve logs/metrics/traces.

Repo: [fireweave-HQ-Demo/arcade](https://github.com/fireweave-HQ-Demo/arcade)

## Commands

| Env | Start | Stop | URL |
|-----|-------|------|-----|
| **dev (hot reload)** | `bun start` | `bun stop` | API http://localhost:3000 · Web http://localhost:5173 |
| **dev (baked image)** | `bun start:docker` | `docker compose --profile docker down` | http://localhost:3000 (no live sync) |
| **prod** | `bun start:prod` | `bun stop:prod` | http://localhost:80 |

Local `bun start` runs **Postgres in Docker** and host **Bun `--watch`** (API + `packages/*`) + **Vite HMR** (UI). Edit files under `apps/` or `packages/` and they sync at runtime — no image rebuild. Optional all-in-Docker mounts: `docker compose -f docker-compose.dev.yml up`.

## Monorepo layout

```
apps/api          clean-architecture Bun API
apps/web          React game centre SPA
packages/game-core
packages/engine-* tic-tac-toe, connect four, rock-paper-scissors
packages/shared   DTOs / AppError
```

## Games (17)

Board / placement games vs arcade bot (RPS removed):

- Tic-Tac-Toe, Misère Tic-Tac-Toe, Wild Tic-Tac-Toe
- Connect Four, Connect Three, Pop Out, Power Four
- Gomoku, Order & Chaos, SOS
- Reversi, Hexapawn, Mancala, Dots & Boxes
- Nim, Subtract a Square, Memory

## Auth & admin

- Cookie sessions (30 days)
- Login UI has **player** and **admin portal** modes
- Default admin: `admin` / `admin` → `/admin`
- Admin portal: game popularity, favoured game, top players, recent matches
- **Metrics inject**: table of every `arcade_*` metric in code; **inject** sends N samples to OpenObserve

## Observability

| Signal | Stream / name |
|--------|----------------|
| Logs | `arcade_logs` |
| Metrics | `arcade_http_*`, `arcade_events`, `arcade_matches_total` |
| Traces | `arcade_traces` |

```bash
curl -s http://localhost:3000/api/observability/verify | jq
```

## Deploy (EC2)

Merges to `main` → `scripts/deploy-prod.sh` (fingerprint skip-build, port 80).

| Item | Value |
|------|--------|
| Host | `54.147.34.187` |
| App dir | `~/arcade` |
| URL | http://54.147.34.187 |

Security group: TCP **22** (GitHub Actions) and **80** (app).

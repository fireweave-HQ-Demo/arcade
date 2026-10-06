# arcade

Multi-game **human vs bot** centre. Bun monorepo with clean-architecture API, pluggable engines, shared auth, cross-game scoreboard, admin popularity insights, and OpenObserve logs/metrics/traces.

Repo: [fireweave-HQ-Demo/arcade](https://github.com/fireweave-HQ-Demo/arcade)

## Commands

| Env | Start | Stop | URL |
|-----|-------|------|-----|
| **dev** | `bun start` | `bun stop` | http://localhost:3000 |
| **prod** | `bun start:prod` | `bun stop:prod` | http://localhost:80 |

## Monorepo layout

```
apps/api          clean-architecture Bun API
apps/web          React game centre SPA
packages/game-core
packages/engine-* tic-tac-toe, connect four, rock-paper-scissors
packages/shared   DTOs / AppError
```

## Games

- **Tic-Tac-Toe** — perfect minimax bot
- **Connect Four** — depth-limited minimax bot
- **Rock Paper Scissors** — adaptive counter bot

## Auth & admin

- Cookie sessions (30 days)
- Default admin: `admin` / `admin`

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

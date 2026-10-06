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
- **OpenObserve** metrics (`login`, `register`, `game_start`, `game_end`)
- Perfect-play bot via **minimax** (O always optimal)

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

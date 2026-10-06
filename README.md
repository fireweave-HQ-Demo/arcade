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

## Deploy notes

Images are alpine + Bun; app is a single process serving API and built assets. Cold `./start` builds layers once; subsequent deploys reuse cache and should stay well under 15s when the image is already on the host (EC2 workflow TBD).

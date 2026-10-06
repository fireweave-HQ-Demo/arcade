import postgres from "postgres";

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgres://tictac:tictac@localhost:5432/tictac";

export const sql = postgres(DATABASE_URL, {
  max: 8,
  idle_timeout: 20,
  connect_timeout: 10,
});

export async function waitForDb(retries = 40) {
  for (let i = 0; i < retries; i++) {
    try {
      await sql`SELECT 1`;
      return;
    } catch {
      await Bun.sleep(250);
    }
  }
  throw new Error("Database not ready");
}

export async function migrate() {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'`;

  await sql`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS matches (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      game_id TEXT NOT NULL,
      state JSONB NOT NULL,
      status TEXT NOT NULL DEFAULT 'playing',
      winner TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS match_events (
      id SERIAL PRIMARY KEY,
      match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
      actor TEXT NOT NULL,
      move JSONB,
      trace_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`ALTER TABLE match_events ADD COLUMN IF NOT EXISTS state JSONB`;

  await sql`CREATE INDEX IF NOT EXISTS idx_matches_user_game ON matches(user_id, game_id, status)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_matches_game ON matches(game_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_matches_user_finished ON matches(user_id, status, id DESC)`;
}

import { join } from "path";
import { migrate, sql } from "./db";
import {
  clearSessionCookie,
  getUserFromRequest,
  login,
  logout,
  register,
  sessionCookie,
} from "./auth";
import {
  applyBotMove,
  applyHumanMove,
  emptyBoard,
  getWinner,
  type Board,
  type Cell,
} from "./game";
import {
  finishRequest,
  listStreams,
  log,
  startRequest,
  track,
  verifyInjection,
  type RequestContext,
} from "./observability";

const PORT = Number(process.env.PORT ?? 3000);
const STATIC = join(import.meta.dir, "../../client/dist");

function json(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify(data), { ...init, headers });
}

function toBoard(raw: unknown): Board {
  const arr = Array.isArray(raw) ? raw : [];
  return Array.from({ length: 9 }, (_, i) => {
    const v = arr[i];
    return v === "X" || v === "O" ? v : ("" as Cell);
  });
}

function apiRoute(path: string) {
  if (path.startsWith("/api/")) return path;
  return "static";
}

async function waitForDb(retries = 30) {
  for (let i = 0; i < retries; i++) {
    try {
      await sql`SELECT 1`;
      return;
    } catch {
      await Bun.sleep(500);
    }
  }
  throw new Error("Database not ready");
}

await waitForDb();
await migrate();
await log("info", "server.start", { port: PORT });
console.log("db ready");

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;
    const route = apiRoute(path);
    const ctx: RequestContext | null = path.startsWith("/api/")
      ? startRequest(req, route)
      : null;

    const respond = async (res: Response, extra?: Record<string, string | number | boolean>) => {
      if (ctx) {
        const headers = new Headers(res.headers);
        headers.set("x-trace-id", ctx.traceId);
        void finishRequest(ctx, res.status, extra);
        return new Response(res.body, { status: res.status, headers });
      }
      return res;
    };

    try {
      if (path === "/api/health") {
        return respond(json({ ok: true, service: "temp-battle" }));
      }

      if (path === "/api/observability/verify" && req.method === "GET") {
        const report = await verifyInjection();
        return respond(json(report), { verify_ok: report.ok });
      }

      if (path === "/api/observability/streams" && req.method === "GET") {
        const type = url.searchParams.get("type") as "logs" | "metrics" | "traces" | null;
        const result = await listStreams(type ?? undefined);
        return respond(json(result.data ?? result));
      }

      // backwards-compatible alias
      if (path === "/api/metrics/streams" && req.method === "GET") {
        const result = await listStreams();
        return respond(json(result.data ?? result));
      }

      if (path === "/api/auth/register" && req.method === "POST") {
        const body = (await req.json()) as { username?: string; password?: string };
        await register(body.username ?? "", body.password ?? "");
        const session = await login(body.username ?? "", body.password ?? "");
        void track({ event: "register", user: session.user.username });
        return respond(
          json(
            { user: session.user },
            { headers: { "Set-Cookie": sessionCookie(session.token, session.maxAge) } },
          ),
          { user: session.user.username },
        );
      }

      if (path === "/api/auth/login" && req.method === "POST") {
        const body = (await req.json()) as { username?: string; password?: string };
        const session = await login(body.username ?? "", body.password ?? "");
        void track({ event: "login", user: session.user.username });
        return respond(
          json(
            { user: session.user },
            { headers: { "Set-Cookie": sessionCookie(session.token, session.maxAge) } },
          ),
          { user: session.user.username },
        );
      }

      if (path === "/api/auth/logout" && req.method === "POST") {
        const user = await getUserFromRequest(req);
        await logout(user?.token);
        if (user) void track({ event: "logout", user: user.username });
        return respond(
          json({ ok: true }, { headers: { "Set-Cookie": clearSessionCookie() } }),
        );
      }

      if (path === "/api/auth/me" && req.method === "GET") {
        const user = await getUserFromRequest(req);
        if (!user) return respond(json({ user: null }));
        return respond(json({ user: { id: user.id, username: user.username } }));
      }

      if (path === "/api/game" && req.method === "GET") {
        const user = await getUserFromRequest(req);
        if (!user) return respond(json({ error: "unauthorized" }, { status: 401 }));

        let [game] = await sql`
          SELECT id, board, status, winner
          FROM games
          WHERE user_id = ${user.id} AND status = 'playing'
          ORDER BY id DESC
          LIMIT 1
        `;

        if (!game) {
          const board = emptyBoard();
          [game] = await sql`
            INSERT INTO games (user_id, board, status)
            VALUES (${user.id}, ${board}, 'playing')
            RETURNING id, board, status, winner
          `;
          void track({ event: "game_start", user: user.username, game_id: game.id });
        }

        return respond(
          json({
            id: game.id,
            board: toBoard(game.board),
            status: game.status,
            winner: game.winner,
          }),
        );
      }

      if (path === "/api/game/new" && req.method === "POST") {
        const user = await getUserFromRequest(req);
        if (!user) return respond(json({ error: "unauthorized" }, { status: 401 }));

        await sql`
          UPDATE games SET status = 'abandoned', updated_at = NOW()
          WHERE user_id = ${user.id} AND status = 'playing'
        `;

        const board = emptyBoard();
        const [game] = await sql`
          INSERT INTO games (user_id, board, status)
          VALUES (${user.id}, ${board}, 'playing')
          RETURNING id, board, status, winner
        `;
        void track({ event: "game_start", user: user.username, game_id: game.id });

        return respond(
          json({
            id: game.id,
            board: toBoard(game.board),
            status: game.status,
            winner: game.winner,
          }),
        );
      }

      if (path === "/api/game/move" && req.method === "POST") {
        const user = await getUserFromRequest(req);
        if (!user) return respond(json({ error: "unauthorized" }, { status: 401 }));

        const body = (await req.json()) as { index?: number };
        const index = Number(body.index);
        if (!Number.isInteger(index) || index < 0 || index > 8) {
          return respond(json({ error: "invalid move" }, { status: 400 }));
        }

        const [game] = await sql`
          SELECT id, board, status, winner
          FROM games
          WHERE user_id = ${user.id} AND status = 'playing'
          ORDER BY id DESC
          LIMIT 1
        `;
        if (!game) return respond(json({ error: "no active game" }, { status: 404 }));

        let board = toBoard(game.board);
        const afterHuman = applyHumanMove(board, index);
        if (!afterHuman) return respond(json({ error: "illegal move" }, { status: 400 }));
        board = afterHuman;

        let winner = getWinner(board);
        if (!winner) {
          board = applyBotMove(board);
          winner = getWinner(board);
        }

        const status = winner ? "finished" : "playing";
        const [updated] = await sql`
          UPDATE games
          SET board = ${board},
              status = ${status},
              winner = ${winner},
              updated_at = NOW()
          WHERE id = ${game.id}
          RETURNING id, board, status, winner
        `;

        if (winner) {
          void track({
            event: "game_end",
            user: user.username,
            game_id: updated.id,
            result: winner === "draw" ? "draw" : winner === "X" ? "human_win" : "bot_win",
          });
        }

        return respond(
          json({
            id: updated.id,
            board: toBoard(updated.board),
            status: updated.status,
            winner: updated.winner,
          }),
        );
      }

      if (path === "/api/stats" && req.method === "GET") {
        const user = await getUserFromRequest(req);
        if (!user) return respond(json({ error: "unauthorized" }, { status: 401 }));

        const [stats] = await sql`
          SELECT
            COUNT(*) FILTER (WHERE status = 'finished')::int AS played,
            COUNT(*) FILTER (WHERE winner = 'X')::int AS wins,
            COUNT(*) FILTER (WHERE winner = 'O')::int AS losses,
            COUNT(*) FILTER (WHERE winner = 'draw')::int AS draws
          FROM games
          WHERE user_id = ${user.id}
        `;
        return respond(json(stats));
      }

      // static SPA
      let filePath = path === "/" ? "/index.html" : path;
      let file = Bun.file(join(STATIC, filePath));
      if (!(await file.exists())) {
        file = Bun.file(join(STATIC, "index.html"));
      }
      if (await file.exists()) return new Response(file);

      return respond(json({ error: "not found" }, { status: 404 }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "server error";
      const status =
        message.includes("credentials") ||
        message.includes("taken") ||
        message.includes("must")
          ? 400
          : 500;
      if (ctx) void log("error", "request.error", { message, route: ctx.route }, ctx);
      return respond(json({ error: message }, { status }));
    }
  },
});

console.log(`temp-battle on http://localhost:${server.port}`);

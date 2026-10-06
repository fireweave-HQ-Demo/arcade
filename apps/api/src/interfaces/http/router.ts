import { join } from "path";
import { AppError } from "@arcade/shared";
import type { AuthUseCases } from "../../application/auth";
import type { GameUseCases } from "../../application/games";
import type { ScoreboardUseCases } from "../../application/scoreboard";
import type { AdminUseCases } from "../../application/admin";
import {
  finishRequest,
  listStreams,
  log,
  startRequest,
  verifyInjection,
  type RequestContext,
} from "../../infrastructure/observability/openobserve";
import {
  clearSessionCookie,
  sessionCookie,
  sessionTokenFromRequest,
} from "./cookies";

const STATIC = join(import.meta.dir, "../../../../web/dist");

function json(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify(data), { ...init, headers });
}

export type AppServices = {
  auth: AuthUseCases;
  games: GameUseCases;
  scoreboard: ScoreboardUseCases;
  admin: AdminUseCases;
};

export function createHandler(services: AppServices) {
  return async function handler(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;
    const ctx: RequestContext | null = path.startsWith("/api/")
      ? startRequest(req, path)
      : null;

    const respond = async (
      res: Response,
      extra?: Record<string, string | number | boolean>,
    ) => {
      if (!ctx) return res;
      const headers = new Headers(res.headers);
      headers.set("x-trace-id", ctx.traceId);
      void finishRequest(ctx, res.status, extra);
      return new Response(res.body, { status: res.status, headers });
    };

    try {
      if (path === "/api/health") {
        return respond(json({ ok: true, service: "arcade", centre: true }));
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

      if (path === "/api/auth/register" && req.method === "POST") {
        const body = (await req.json()) as { username?: string; password?: string };
        const session = await services.auth.register(body.username ?? "", body.password ?? "");
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
        const session = await services.auth.login(body.username ?? "", body.password ?? "");
        return respond(
          json(
            { user: session.user },
            { headers: { "Set-Cookie": sessionCookie(session.token, session.maxAge) } },
          ),
          { user: session.user.username },
        );
      }

      if (path === "/api/auth/logout" && req.method === "POST") {
        await services.auth.logout(sessionTokenFromRequest(req));
        return respond(
          json({ ok: true }, { headers: { "Set-Cookie": clearSessionCookie() } }),
        );
      }

      if (path === "/api/auth/me" && req.method === "GET") {
        const user = await services.auth.me(sessionTokenFromRequest(req));
        if (!user) return respond(json({ user: null }));
        return respond(
          json({ user: { id: user.id, username: user.username, role: user.role } }),
        );
      }

      if (path === "/api/games" && req.method === "GET") {
        return respond(json({ games: services.games.listGames() }));
      }

      const matchGet = path.match(/^\/api\/games\/([^/]+)\/match$/);
      if (matchGet && req.method === "GET") {
        const user = await services.auth.me(sessionTokenFromRequest(req));
        if (!user) return respond(json({ error: "unauthorized" }, { status: 401 }));
        const match = await services.games.getOrCreateMatch(user, matchGet[1]!, ctx?.traceId);
        return respond(json(match), { game: match.gameId });
      }

      const matchNew = path.match(/^\/api\/games\/([^/]+)\/match\/new$/);
      if (matchNew && req.method === "POST") {
        const user = await services.auth.me(sessionTokenFromRequest(req));
        if (!user) return respond(json({ error: "unauthorized" }, { status: 401 }));
        const match = await services.games.newMatch(user, matchNew[1]!, ctx?.traceId);
        return respond(json(match), { game: match.gameId });
      }

      const matchMove = path.match(/^\/api\/games\/([^/]+)\/match\/move$/);
      if (matchMove && req.method === "POST") {
        const user = await services.auth.me(sessionTokenFromRequest(req));
        if (!user) return respond(json({ error: "unauthorized" }, { status: 401 }));
        const body = await req.json();
        const match = await services.games.applyMove(
          user,
          matchMove[1]!,
          body,
          ctx?.traceId,
        );
        return respond(json(match), { game: match.gameId });
      }

      if (path === "/api/scoreboard" && req.method === "GET") {
        const user = await services.auth.me(sessionTokenFromRequest(req));
        if (!user) return respond(json({ error: "unauthorized" }, { status: 401 }));
        const [me, leaderboard] = await Promise.all([
          services.scoreboard.forUser(user),
          services.scoreboard.leaderboard(),
        ]);
        return respond(json({ me, leaderboard }));
      }

      if (path === "/api/admin/insights" && req.method === "GET") {
        const user = await services.auth.me(sessionTokenFromRequest(req));
        if (!user) return respond(json({ error: "unauthorized" }, { status: 401 }));
        const insights = await services.admin.insights(user);
        return respond(json(insights));
      }

      if (path === "/api/admin/metrics" && req.method === "GET") {
        const user = await services.auth.me(sessionTokenFromRequest(req));
        if (!user) return respond(json({ error: "unauthorized" }, { status: 401 }));
        return respond(json(services.admin.listMetrics(user)));
      }

      if (path === "/api/admin/metrics/inject" && req.method === "POST") {
        const user = await services.auth.me(sessionTokenFromRequest(req));
        if (!user) return respond(json({ error: "unauthorized" }, { status: 401 }));
        const body = (await req.json()) as {
          name?: string;
          count?: number;
          labels?: Record<string, string>;
        };
        const result = await services.admin.injectMetric(
          user,
          body.name ?? "",
          body.count ?? 0,
          body.labels,
        );
        return respond(json(result), {
          metric: result.metric,
          ingested: result.ingested,
        });
      }

      // static SPA
      let filePath = path === "/" ? "/index.html" : path;
      let file = Bun.file(join(STATIC, filePath));
      if (!(await file.exists())) file = Bun.file(join(STATIC, "index.html"));
      if (await file.exists()) return new Response(file);

      return respond(json({ error: "not found" }, { status: 404 }));
    } catch (err) {
      if (err instanceof AppError) {
        return respond(json({ error: err.message, code: err.code }, { status: err.status }));
      }
      const message = err instanceof Error ? err.message : "server error";
      if (ctx) void log("error", "request.error", { message, route: ctx.route }, ctx);
      return respond(json({ error: message }, { status: 500 }));
    }
  };
}

import { AppError, type PublicUser } from "@arcade/shared";
import type { EngineCatalog, MatchRepository, ObservabilityPort, TraceCtx } from "../domain/ports";

function traceFields(trace?: TraceCtx) {
  return { traceId: trace?.traceId, parentSpanId: trace?.parentSpanId };
}

export function createAdminUseCases(deps: {
  matches: MatchRepository;
  engines: EngineCatalog;
  obs: ObservabilityPort;
}) {
  return {
    async insights(user: PublicUser, trace?: TraceCtx) {
      if (user.role !== "admin") throw new AppError("Forbidden", 403, "forbidden");

      const [popularity, recent, leaderboard] = await Promise.all([
        deps.matches.popularity(),
        deps.matches.recentMatches(30),
        deps.matches.globalScoreboard(10),
      ]);

      const catalogue = deps.engines.list().map((e) => ({
        id: e.id,
        name: e.name,
      }));

      const enriched = catalogue
        .map((g) => {
          const p = popularity.find((x) => x.gameId === g.id);
          return {
            gameId: g.id,
            name: g.name,
            plays: p?.plays ?? 0,
            humanWins: p?.humanWins ?? 0,
            botWins: p?.botWins ?? 0,
            draws: p?.draws ?? 0,
            plays24h: p?.plays24h ?? 0,
          };
        })
        .sort((a, b) => b.plays - a.plays);

      const favored = enriched[0] ?? null;

      await deps.obs.emitAction({
        event: "admin.insights",
        ...traceFields(trace),
        user: user.username,
        metrics: [
          {
            name: "arcade_events",
            value: 1,
            labels: { event: "admin_insights", result: "ok" },
          },
        ],
      });

      return {
        popularity: enriched,
        favored,
        recent,
        leaderboard,
        totals: {
          plays: enriched.reduce((s, g) => s + g.plays, 0),
          plays24h: enriched.reduce((s, g) => s + g.plays24h, 0),
          players: leaderboard.length,
        },
      };
    },
  };
}

export type AdminUseCases = ReturnType<typeof createAdminUseCases>;

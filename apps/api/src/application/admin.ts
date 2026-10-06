import { AppError, type PublicUser } from "@arcade/shared";
import type { EngineCatalog, MatchRepository, ObservabilityPort } from "../domain/ports";

export function createAdminUseCases(deps: {
  matches: MatchRepository;
  engines: EngineCatalog;
  obs: ObservabilityPort;
}) {
  return {
    async insights(user: PublicUser) {
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

      const enriched = catalogue.map((g) => {
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
      }).sort((a, b) => b.plays - a.plays);

      void deps.obs.log("info", "admin.insights", { admin: user.username });
      void deps.obs.span({
        name: "admin.insights",
        attributes: { "user.name": user.username },
      });

      return {
        popularity: enriched,
        recent,
        leaderboard,
        totals: {
          plays: enriched.reduce((s, g) => s + g.plays, 0),
          plays24h: enriched.reduce((s, g) => s + g.plays24h, 0),
        },
      };
    },
  };
}

export type AdminUseCases = ReturnType<typeof createAdminUseCases>;

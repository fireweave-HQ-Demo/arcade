import type { PublicUser, Scoreboard } from "@arcade/shared";
import type { MatchRepository, ObservabilityPort, TraceCtx } from "../domain/ports";

function traceFields(trace?: TraceCtx) {
  return { traceId: trace?.traceId, parentSpanId: trace?.parentSpanId };
}

export function createScoreboardUseCases(deps: {
  matches: MatchRepository;
  obs: ObservabilityPort;
}) {
  return {
    async forUser(user: PublicUser, trace?: TraceCtx): Promise<Scoreboard> {
      const byGame = await deps.matches.scoreboardForUser(user.id);
      const global = byGame.reduce(
        (acc, row) => ({
          played: acc.played + row.played,
          wins: acc.wins + row.wins,
          losses: acc.losses + row.losses,
          draws: acc.draws + row.draws,
        }),
        { played: 0, wins: 0, losses: 0, draws: 0 },
      );
      await deps.obs.emitAction({
        event: "scoreboard.view",
        ...traceFields(trace),
        user: user.username,
        metrics: [{ name: "arcade_scoreboard_views_total", value: 1, labels: {} }],
      });
      return { global, byGame };
    },

    async leaderboard() {
      return deps.matches.globalScoreboard(20);
    },
  };
}

export type ScoreboardUseCases = ReturnType<typeof createScoreboardUseCases>;

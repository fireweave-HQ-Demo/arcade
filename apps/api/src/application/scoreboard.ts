import type { PublicUser, Scoreboard } from "@arcade/shared";
import type { MatchRepository, ObservabilityPort } from "../domain/ports";

export function createScoreboardUseCases(deps: {
  matches: MatchRepository;
  obs: ObservabilityPort;
}) {
  return {
    async forUser(user: PublicUser): Promise<Scoreboard> {
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
      void deps.obs.span({
        name: "scoreboard.me",
        attributes: { "user.name": user.username },
      });
      return { global, byGame };
    },

    async leaderboard() {
      return deps.matches.globalScoreboard(20);
    },
  };
}

export type ScoreboardUseCases = ReturnType<typeof createScoreboardUseCases>;

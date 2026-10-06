import { AppError, type MatchDto, type MatchResult, type PublicUser } from "@arcade/shared";
import type {
  EngineCatalog,
  MatchRepository,
  ObservabilityPort,
} from "../domain/ports";

function toDto(m: {
  id: number;
  gameId: string;
  state: unknown;
  status: string;
  winner: MatchResult;
}): MatchDto {
  return {
    id: m.id,
    gameId: m.gameId,
    state: m.state,
    status: m.status as MatchDto["status"],
    winner: m.winner,
  };
}

export function createGameUseCases(deps: {
  matches: MatchRepository;
  engines: EngineCatalog;
  obs: ObservabilityPort;
}) {
  return {
    listGames() {
      return deps.engines.list().map((e) => ({
        id: e.id,
        name: e.name,
        description: e.description,
        rules: e.rules,
      }));
    },

    async getOrCreateMatch(user: PublicUser, gameId: string, traceId?: string) {
      const engine = (() => {
        try {
          return deps.engines.require(gameId);
        } catch {
          throw new AppError("Unknown game", 404, "not_found");
        }
      })();

      let match = await deps.matches.findActive(user.id, gameId);
      if (!match) {
        match = await deps.matches.create(user.id, gameId, engine.newState());
        await deps.matches.addEvent({
          matchId: match.id,
          actor: "system",
          move: { event: "start" },
          traceId,
        });
        void deps.obs.log("info", "match.start", {
          game_id: gameId,
          match_id: match.id,
          user: user.username,
        });
        void deps.obs.metric("arcade_matches_total", 1, { game: gameId, result: "started" });
        void deps.obs.metric("arcade_game_popularity", 1, { game: gameId });
        void deps.obs.span({
          name: "match.start",
          traceId,
          attributes: { "game.id": gameId, "match.id": match.id, "user.name": user.username },
        });
      }
      return toDto(match);
    },

    async newMatch(user: PublicUser, gameId: string, traceId?: string) {
      deps.engines.require(gameId);
      await deps.matches.abandonActive(user.id, gameId);
      return this.getOrCreateMatch(user, gameId, traceId);
    },

    async applyMove(
      user: PublicUser,
      gameId: string,
      move: unknown,
      traceId?: string,
    ): Promise<MatchDto> {
      const engine = (() => {
        try {
          return deps.engines.require(gameId);
        } catch {
          throw new AppError("Unknown game", 404, "not_found");
        }
      })();

      const match = await deps.matches.findActive(user.id, gameId);
      if (!match) throw new AppError("No active match", 404, "not_found");

      const human = engine.applyHumanMove(match.state, move);
      if (human.illegal) throw new AppError("Illegal move");

      let state = human.state;
      await deps.matches.addEvent({
        matchId: match.id,
        actor: "human",
        move,
        traceId,
      });
      void deps.obs.metric("arcade_moves_total", 1, { game: gameId, actor: "human" });

      let status = engine.status(state);
      if (status === "playing") {
        state = engine.applyBotMove(state);
        await deps.matches.addEvent({
          matchId: match.id,
          actor: "bot",
          move: { auto: true },
          traceId,
        });
        void deps.obs.metric("arcade_moves_total", 1, { game: gameId, actor: "bot" });
        status = engine.status(state);
      }

      match.state = state;
      if (status === "playing") {
        match.status = "playing";
        match.winner = null;
      } else {
        match.status = "finished";
        match.winner = status;
        void deps.obs.log("info", "match.end", {
          game_id: gameId,
          match_id: match.id,
          result: status,
          user: user.username,
        });
        void deps.obs.metric("arcade_matches_total", 1, { game: gameId, result: status });
        void deps.obs.span({
          name: "match.end",
          traceId,
          attributes: {
            "game.id": gameId,
            "match.id": match.id,
            result: status,
          },
        });
      }

      const updated = await deps.matches.update(match);
      void deps.obs.span({
        name: "match.move",
        traceId,
        attributes: { "game.id": gameId, "match.id": match.id },
      });
      return toDto(updated);
    },
  };
}

export type GameUseCases = ReturnType<typeof createGameUseCases>;

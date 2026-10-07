import {
  AppError,
  type BotDifficulty,
  type MatchDto,
  type MatchResult,
  type PublicUser,
} from "@arcade/shared";
import type {
  EngineCatalog,
  MatchRepository,
  ObservabilityPort,
  TraceCtx,
} from "../domain/ports";
import { fw } from "../fireweave/fw-harness";

/** In-process active match gauges + start clocks for duration histograms. */
const activeByGame = new Map<string, number>();
const matchStartedAt = new Map<number, number>();

function bumpActive(gameId: string, delta: number) {
  const next = Math.max(0, (activeByGame.get(gameId) ?? 0) + delta);
  activeByGame.set(gameId, next);
  return next;
}

function toDto(m: {
  id: number;
  gameId: string;
  state: unknown;
  status: string;
  winner: MatchResult;
  difficulty?: BotDifficulty | null;
}): MatchDto {
  return {
    id: m.id,
    gameId: m.gameId,
    state: m.state,
    status: m.status as MatchDto["status"],
    winner: m.winner,
    difficulty: m.difficulty ?? null,
  };
}

export function parseDifficulty(value: unknown): BotDifficulty | undefined {
  if (value === "easy" || value === "mid" || value === "hard" || value === "nightmare") return value;
  return undefined;
}

function traceFields(trace?: TraceCtx) {
  return { traceId: trace?.traceId, parentSpanId: trace?.parentSpanId };
}

async function replaySnapshots(userId: number) {
  // @fireweave-controlpoint match-replay
  return fw.controlPoints.getBooleanValue("match-replay", false, {
    targetingKey: String(userId),
  });
}

const PIN_LIMIT = 6;

export function createGameUseCases(deps: {
  matches: MatchRepository;
  engines: EngineCatalog;
  obs: ObservabilityPort;
  pins: {
    list(userId: number): Promise<string[]>;
    add(userId: number, gameId: string): Promise<void>;
    remove(userId: number, gameId: string): Promise<boolean>;
  };
}) {
  return {
    async listGames(trace?: TraceCtx) {
      const games = deps.engines.list().map((e) => ({
        id: e.id,
        name: e.name,
        description: e.description,
        rules: e.rules,
      }));
      await deps.obs.emitAction({
        event: "lobby.view",
        ...traceFields(trace),
        metrics: [{ name: "arcade_lobby_views_total", value: 1, labels: {} }],
        spanAttributes: { games: games.length },
      });
      return games;
    },

    async getOrCreateMatch(
      user: PublicUser,
      gameId: string,
      trace?: TraceCtx,
      difficulty?: BotDifficulty,
    ) {
      const snap = await replaySnapshots(user.id);
      const engine = (() => {
        try {
          return deps.engines.require(gameId);
        } catch {
          throw new AppError("Unknown game", 404, "not_found");
        }
      })();

      let match = await deps.matches.findActive(user.id, gameId);
      if (!match) {
        match = await deps.matches.create(user.id, gameId, engine.newState(), difficulty ?? null);
        await deps.matches.addEvent({
          matchId: match.id,
          actor: "system",
          move: { event: "start" },
          traceId: trace?.traceId,
          state: snap ? match.state : undefined,
        });
        matchStartedAt.set(match.id, Date.now());
        const active = bumpActive(gameId, 1);
        await deps.obs.emitAction({
          event: "match.start",
          ...traceFields(trace),
          user: user.username,
          gameId,
          matchId: match.id,
          metrics: [
            { name: "arcade_matches_total", value: 1, labels: { game: gameId, result: "started" } },
            { name: "arcade_game_popularity", value: 1, labels: { game: gameId } },
            {
              name: "arcade_active_matches",
              value: active,
              labels: { game: gameId },
              type: "gauge",
            },
          ],
        });
      }
      return toDto(match);
    },

    async newMatch(user: PublicUser, gameId: string, trace?: TraceCtx, difficulty?: BotDifficulty) {
      deps.engines.require(gameId);
      const existing = await deps.matches.findActive(user.id, gameId);
      if (existing) {
        matchStartedAt.delete(existing.id);
        const active = bumpActive(gameId, -1);
        void deps.obs.metric("arcade_active_matches", active, { game: gameId }, "gauge");
      }
      await deps.matches.abandonActive(user.id, gameId);
      return this.getOrCreateMatch(user, gameId, trace, difficulty);
    },

    async applyMove(
      user: PublicUser,
      gameId: string,
      move: unknown,
      trace?: TraceCtx,
    ): Promise<MatchDto> {
      const snap = await replaySnapshots(user.id);
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
      if (human.illegal) {
        await deps.obs.emitAction({
          event: "match.illegal",
          ...traceFields(trace),
          user: user.username,
          gameId,
          matchId: match.id,
          logLevel: "warn",
          metrics: [
            { name: "arcade_illegal_moves_total", value: 1, labels: { game: gameId } },
          ],
          statusCode: 2,
          statusMessage: "illegal move",
        });
        throw new AppError("Illegal move");
      }

      let state = human.state;
      await deps.matches.addEvent({
        matchId: match.id,
        actor: "human",
        move,
        traceId: trace?.traceId,
        state: snap ? state : undefined,
      });
      await deps.obs.emitAction({
        event: "match.move",
        ...traceFields(trace),
        user: user.username,
        gameId,
        matchId: match.id,
        metrics: [
          { name: "arcade_moves_total", value: 1, labels: { game: gameId, actor: "human" } },
        ],
        logFields: { actor: "human" },
        spanAttributes: { actor: "human" },
      });

      let status = engine.status(state);
      if (status === "playing") {
        const botStart = Date.now();
        state = engine.applyBotMove(state, match.difficulty ?? undefined);
        const botMs = Date.now() - botStart;
        await deps.matches.addEvent({
          matchId: match.id,
          actor: "bot",
          move: { auto: true },
          traceId: trace?.traceId,
          state: snap ? state : undefined,
        });
        await deps.obs.emitAction({
          event: "match.move",
          ...traceFields(trace),
          user: user.username,
          gameId,
          matchId: match.id,
          metrics: [
            { name: "arcade_moves_total", value: 1, labels: { game: gameId, actor: "bot" } },
          ],
          logFields: { actor: "bot" },
          spanAttributes: { actor: "bot" },
        });
        await deps.obs.emitAction({
          event: "match.bot_think",
          ...traceFields(trace),
          gameId,
          matchId: match.id,
          metrics: [
            {
              name: "arcade_bot_move_duration_ms",
              value: botMs,
              labels: { game: gameId },
              type: "histogram",
            },
          ],
          logFields: { duration_ms: botMs },
          spanAttributes: { "bot.duration_ms": botMs },
        });
        status = engine.status(state);
      }

      match.state = state;
      if (status === "playing") {
        match.status = "playing";
        match.winner = null;
      } else {
        match.status = "finished";
        match.winner = status;
        const started = matchStartedAt.get(match.id) ?? Date.now();
        matchStartedAt.delete(match.id);
        const durationMs = Math.max(0, Date.now() - started);
        const active = bumpActive(gameId, -1);
        await deps.obs.emitAction({
          event: "match.end",
          ...traceFields(trace),
          user: user.username,
          gameId,
          matchId: match.id,
          metrics: [
            { name: "arcade_matches_total", value: 1, labels: { game: gameId, result: status } },
            {
              name: "arcade_match_duration_ms",
              value: durationMs,
              labels: { game: gameId, result: status },
              type: "histogram",
            },
            {
              name: "arcade_active_matches",
              value: active,
              labels: { game: gameId },
              type: "gauge",
            },
          ],
          logFields: { result: status, duration_ms: durationMs },
          spanAttributes: { result: status, "match.duration_ms": durationMs },
        });
      }

      const updated = await deps.matches.update(match);
      return toDto(updated);
    },

    async listPins(user: PublicUser) {
      return deps.pins.list(user.id);
    },

    async pin(user: PublicUser, gameId: string) {
      try {
        deps.engines.require(gameId);
      } catch {
        throw new AppError("Unknown game", 404, "unknown_game");
      }
      const current = await deps.pins.list(user.id);
      if (current.includes(gameId)) throw new AppError("Already pinned", 409, "already_pinned");
      if (current.length >= PIN_LIMIT) throw new AppError("Pin limit reached", 409, "limit");
      await deps.pins.add(user.id, gameId);
      return [...current, gameId];
    },

    async unpin(user: PublicUser, gameId: string) {
      try {
        deps.engines.require(gameId);
      } catch {
        throw new AppError("Unknown game", 404, "unknown_game");
      }
      const removed = await deps.pins.remove(user.id, gameId);
      if (!removed) throw new AppError("Not pinned", 404, "not_pinned");
      return deps.pins.list(user.id);
    },
  };
}

export type GameUseCases = ReturnType<typeof createGameUseCases>;

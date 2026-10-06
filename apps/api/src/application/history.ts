import { AppError, type MatchResult, type PublicUser } from "@arcade/shared";
import type {
  EngineCatalog,
  MatchRepository,
  ObservabilityPort,
  TraceCtx,
} from "../domain/ports";
import { fw } from "../fireweave/fw-harness";

function traceFields(trace?: TraceCtx) {
  return { traceId: trace?.traceId, parentSpanId: trace?.parentSpanId };
}

export type HistoryMatch = {
  id: number;
  gameId: string;
  name: string;
  winner: MatchResult;
  createdAt: string;
};

export type ReplayFrame = {
  index: number;
  actor: "human" | "bot" | "system";
  state: unknown;
};

export type Replay = {
  id: number;
  gameId: string;
  name: string;
  winner: MatchResult;
  createdAt: string;
  frames: ReplayFrame[];
};

export function createHistoryUseCases(deps: {
  matches: MatchRepository;
  engines: EngineCatalog;
  obs: ObservabilityPort;
}) {
  const record = deps.obs.metric.bind(deps.obs);

  return {
    async listHistory(user: PublicUser, trace?: TraceCtx): Promise<HistoryMatch[]> {
      // @fireweave-controlpoint match-replay
      const enabled = await fw.controlPoints.getBooleanValue("match-replay", false, {
        targetingKey: String(user.id),
      });
      if (!enabled) throw new AppError("Not found", 404, "not_found");

      let rows;
      try {
        rows = await deps.matches.listFinished(user.id, 40);
      } catch (err) {
        await record("arcade_match_history_errors_total", 1, { reason: "query_failed" }, "counter");
        await deps.obs.emitAction({
          event: "match.history",
          ...traceFields(trace),
          user: user.username,
          logLevel: "error",
          logFields: { reason: "query_failed" },
          statusCode: 2,
          statusMessage: err instanceof Error ? err.message : "query failed",
        });
        throw err;
      }

      const names = new Map(deps.engines.list().map((engine) => [engine.id, engine.name]));
      await record("arcade_match_history_views_total", 1, { result: "ok" }, "counter");
      await deps.obs.emitAction({
        event: "match.history",
        ...traceFields(trace),
        user: user.username,
        logFields: { matches: rows.length },
        spanAttributes: { matches: rows.length },
      });
      return rows.map((row) => ({
        id: row.id,
        gameId: row.gameId,
        name: names.get(row.gameId) ?? row.gameId,
        winner: row.winner,
        createdAt: row.createdAt,
      }));
    },

    async replay(user: PublicUser, matchId: number, trace?: TraceCtx): Promise<Replay> {
      // @fireweave-controlpoint match-replay
      const enabled = await fw.controlPoints.getBooleanValue("match-replay", false, {
        targetingKey: String(user.id),
      });
      if (!enabled) throw new AppError("Not found", 404, "not_found");

      const started = Date.now();
      let gameId = "";
      try {
        const match = await deps.matches.findForUser(user.id, matchId);
        if (!match) throw new AppError("Match not found", 404, "not_found");
        gameId = match.gameId;
        if (match.status === "playing") {
          throw new AppError("Match is still in progress", 409, "still_playing");
        }
        if (match.status !== "finished") {
          throw new AppError("Match cannot be replayed", 409, "incomplete");
        }
        const events = await deps.matches.listEvents(match.id);
        if (events.length === 0 || events.some((event) => event.state == null)) {
          throw new AppError("Replay log is incomplete", 409, "incomplete");
        }
        const names = new Map(deps.engines.list().map((engine) => [engine.id, engine.name]));
        const frames: ReplayFrame[] = events.map((event, index) => ({
          index,
          actor: event.actor,
          state: event.state,
        }));
        const elapsed = Date.now() - started;
        await record(
          "arcade_replay_loads_total",
          1,
          { result: "ok", game: gameId },
          "counter",
        );
        await record(
          "arcade_replay_load_ms",
          elapsed,
          { result: "ok", game: gameId },
          "histogram",
        );
        await deps.obs.emitAction({
          event: "match.replay",
          ...traceFields(trace),
          user: user.username,
          gameId,
          matchId: match.id,
          logFields: { frames: frames.length, duration_ms: elapsed },
          spanAttributes: { frames: frames.length, "replay.duration_ms": elapsed },
        });
        return {
          id: match.id,
          gameId,
          name: names.get(gameId) ?? gameId,
          winner: match.winner,
          createdAt: match.createdAt,
          frames,
        };
      } catch (err) {
        const reason = err instanceof AppError ? err.code : "query_failed";
        const elapsed = Date.now() - started;
        const labels = { result: "error", game: gameId || "unknown" };
        await record("arcade_replay_errors_total", 1, { reason, game: labels.game }, "counter");
        await record("arcade_replay_loads_total", 1, labels, "counter");
        await record("arcade_replay_load_ms", elapsed, labels, "histogram");
        await deps.obs.emitAction({
          event: "match.replay",
          ...traceFields(trace),
          user: user.username,
          gameId: gameId || undefined,
          matchId,
          logLevel: "error",
          logFields: { reason, duration_ms: elapsed },
          statusCode: 2,
          statusMessage: err instanceof Error ? err.message : "replay failed",
        });
        throw err;
      }
    },
  };
}

export type HistoryUseCases = ReturnType<typeof createHistoryUseCases>;

import { AppError, type PublicUser } from "@arcade/shared";
import type { EngineCatalog, MatchRepository, ObservabilityPort, TraceCtx } from "../domain/ports";
import { ACTIONS_CATALOG, findAction } from "../infrastructure/observability/actions-catalog";
import { findMetric, METRICS_CATALOG } from "../infrastructure/observability/metrics-catalog";
import {
  injectActionSamples,
  injectMetricSamples,
  observabilityEnabled,
} from "../infrastructure/observability/openobserve";

const MAX_INJECT = 500;

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

    listMetrics(user: PublicUser) {
      if (user.role !== "admin") throw new AppError("Forbidden", 403, "forbidden");
      return {
        configured: observabilityEnabled(),
        maxInject: MAX_INJECT,
        metrics: METRICS_CATALOG,
        actions: ACTIONS_CATALOG,
      };
    },

    async injectMetric(
      user: PublicUser,
      name: string,
      count: number,
      labels?: Record<string, string>,
      trace?: TraceCtx,
    ) {
      if (user.role !== "admin") throw new AppError("Forbidden", 403, "forbidden");

      const def = findMetric(name);
      if (!def) throw new AppError(`Unknown metric: ${name}`, 400, "bad_request");

      const n = Math.floor(Number(count));
      if (!Number.isFinite(n) || n < 1 || n > MAX_INJECT) {
        throw new AppError(`count must be 1–${MAX_INJECT}`, 400, "bad_request");
      }

      const mergedLabels = { ...def.defaultLabels, ...(labels ?? {}) };
      const result = await injectMetricSamples(def.name, n, mergedLabels, def.type, 1);

      await deps.obs.emitAction({
        event: "admin.metric_inject",
        ...traceFields(trace),
        user: user.username,
        metrics: [
          {
            name: "arcade_admin_injects_total",
            value: 1,
            labels: { kind: "metric", target: def.name },
          },
        ],
        logFields: {
          metric: def.name,
          count: n,
          ingested: result.ingested,
          ok: result.ok,
          skipped: result.skipped,
        },
        statusCode: result.ok || result.skipped ? 1 : 2,
      });

      if (result.skipped) {
        throw new AppError(
          "OpenObserve is not configured (set OPENOBSERVE_URL / USER / PASSWORD)",
          503,
          "unavailable",
        );
      }

      return {
        metric: def.name,
        requested: n,
        ingested: result.ingested,
        ok: result.ok,
        status: result.status,
        labels: mergedLabels,
      };
    },

    async injectAction(user: PublicUser, event: string, count: number, trace?: TraceCtx) {
      if (user.role !== "admin") throw new AppError("Forbidden", 403, "forbidden");

      const def = findAction(event);
      if (!def) throw new AppError(`Unknown action: ${event}`, 400, "bad_request");

      const n = Math.floor(Number(count));
      if (!Number.isFinite(n) || n < 1 || n > MAX_INJECT) {
        throw new AppError(`count must be 1–${MAX_INJECT}`, 400, "bad_request");
      }

      const result = await injectActionSamples(def.event, n);

      await deps.obs.emitAction({
        event: "admin.action_inject",
        ...traceFields(trace),
        user: user.username,
        metrics: [
          {
            name: "arcade_admin_injects_total",
            value: 1,
            labels: { kind: "action", target: def.event },
          },
        ],
        logFields: {
          action: def.event,
          count: n,
          ingested: result.ingested,
          ok: result.ok,
          skipped: result.skipped,
        },
        statusCode: result.ok || result.skipped ? 1 : 2,
      });

      if (result.skipped) {
        throw new AppError(
          "OpenObserve is not configured (set OPENOBSERVE_URL / USER / PASSWORD)",
          503,
          "unavailable",
        );
      }

      return {
        event: def.event,
        requested: n,
        ingested: result.ingested,
        ok: result.ok,
        status: result.status,
      };
    },
  };
}

export type AdminUseCases = ReturnType<typeof createAdminUseCases>;

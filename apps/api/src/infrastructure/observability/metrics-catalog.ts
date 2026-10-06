/**
 * Single catalog of every metric emitted by arcade.
 * Admin portal lists these and can inject N samples into OpenObserve.
 */
export type MetricDef = {
  name: string;
  type: "counter" | "gauge" | "histogram";
  description: string;
  /** Example / default labels used when injecting from admin UI */
  defaultLabels: Record<string, string>;
  /** Where it is emitted in code */
  source: string;
};

export const METRICS_CATALOG: MetricDef[] = [
  {
    name: "arcade_http_requests",
    type: "counter",
    description: "HTTP requests handled by the API",
    defaultLabels: { method: "GET", route: "/api/health", status: "200" },
    source: "openobserve.startRequest / finishRequest",
  },
  {
    name: "arcade_http_duration_ms",
    type: "histogram",
    description: "HTTP request duration in milliseconds",
    defaultLabels: { method: "GET", route: "/api/health", status: "200" },
    source: "openobserve.finishRequest",
  },
  {
    name: "arcade_events",
    type: "counter",
    description: "Auth and product events (login, register, …)",
    defaultLabels: { event: "admin_inject" },
    source: "auth.login / auth.register",
  },
  {
    name: "arcade_matches_total",
    type: "counter",
    description: "Matches started or finished",
    defaultLabels: { game: "tictactoe", result: "started" },
    source: "games.getOrCreateMatch / games.applyMove",
  },
  {
    name: "arcade_game_popularity",
    type: "counter",
    description: "Game selection / play popularity",
    defaultLabels: { game: "tictactoe" },
    source: "games.getOrCreateMatch",
  },
  {
    name: "arcade_moves_total",
    type: "counter",
    description: "Human and bot moves applied",
    defaultLabels: { game: "tictactoe", actor: "human" },
    source: "games.applyMove",
  },
  {
    name: "arcade_verify",
    type: "counter",
    description: "Observability probe / verify injections",
    defaultLabels: { probe_id: "admin", signal: "metrics" },
    source: "openobserve.verifyInjection",
  },
];

export function findMetric(name: string): MetricDef | undefined {
  return METRICS_CATALOG.find((m) => m.name === name);
}

export function metricNames(): string[] {
  return METRICS_CATALOG.map((m) => m.name);
}

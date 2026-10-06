/**
 * Single catalog of every metric emitted by arcade.
 */
export type MetricDef = {
  name: string;
  type: "counter" | "gauge" | "histogram";
  description: string;
  /** Example / default labels */
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
    source: "openobserve.finishRequest",
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
    description: "Auth and product events (login, register, logout, …)",
    defaultLabels: { event: "admin_insights", result: "ok" },
    source: "emitAction (auth.*, admin.*, …)",
  },
  {
    name: "arcade_auth_failures_total",
    type: "counter",
    description: "Failed login or register attempts",
    defaultLabels: { reason: "bad_password" },
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
    name: "arcade_illegal_moves_total",
    type: "counter",
    description: "Illegal human moves rejected",
    defaultLabels: { game: "tictactoe" },
    source: "games.applyMove",
  },
  {
    name: "arcade_match_duration_ms",
    type: "histogram",
    description: "Finished match duration in milliseconds",
    defaultLabels: { game: "tictactoe", result: "human_win" },
    source: "games.applyMove (match.end)",
  },
  {
    name: "arcade_bot_move_duration_ms",
    type: "histogram",
    description: "Bot engine think time in milliseconds",
    defaultLabels: { game: "tictactoe" },
    source: "games.applyMove",
  },
  {
    name: "arcade_active_matches",
    type: "gauge",
    description: "In-process count of active matches by game",
    defaultLabels: { game: "tictactoe" },
    source: "games match.start / match.end",
  },
  {
    name: "arcade_lobby_views_total",
    type: "counter",
    description: "Lobby / game list views",
    defaultLabels: {},
    source: "games.listGames",
  },
  {
    name: "arcade_scoreboard_views_total",
    type: "counter",
    description: "Scoreboard page loads",
    defaultLabels: {},
    source: "scoreboard.forUser",
  },
  {
    name: "arcade_openobserve_export_errors_total",
    type: "counter",
    description: "Failed exports to OpenObserve",
    defaultLabels: { signal: "metrics" },
    source: "openobserve postJson failures",
  },
  {
    name: "arcade_web_events",
    type: "counter",
    description: "Web client product events (login, lobby, …)",
    defaultLabels: { event: "lobby_view", result: "ok", surface: "web" },
    source: "POST /api/client-telemetry (web)",
  },
  {
    name: "arcade_web_lobby_views_total",
    type: "counter",
    description: "Lobby page loads from the web client",
    defaultLabels: { surface: "web" },
    source: "LobbyPage useEffect",
  },
  {
    name: "arcade_web_profile_menu_opens_total",
    type: "counter",
    description: "Profile avatar menu opened",
    defaultLabels: { surface: "web", event: "open", result: "ok" },
    source: "ProfileMenu toggle",
  },
  {
    name: "arcade_web_profile_menu_load_success_total",
    type: "counter",
    description: "Profile menu record loaded",
    defaultLabels: { surface: "web", event: "load", result: "ok" },
    source: "ProfileMenu scoreboard fetch",
  },
  {
    name: "arcade_web_profile_menu_load_errors_total",
    type: "counter",
    description: "Profile menu record failed to load",
    defaultLabels: { surface: "web", event: "load", result: "error" },
    source: "ProfileMenu scoreboard fetch",
  },
  {
    name: "arcade_web_profile_menu_load_ms",
    type: "histogram",
    description: "Time to load the profile menu record",
    defaultLabels: { surface: "web", event: "load", result: "ok" },
    source: "ProfileMenu scoreboard fetch",
  },
  {
    name: "arcade_web_header_views_total",
    type: "counter",
    description: "Unified header shown with logo, games, and scoreboard on one row",
    defaultLabels: { surface: "web", event: "view", result: "ok" },
    source: "UnifiedHeader mount",
  },
  {
    name: "arcade_web_header_nav_clicks_total",
    type: "counter",
    description: "Clicks on logo, games, or scoreboard in the unified header",
    defaultLabels: { surface: "web", event: "nav", result: "ok", target: "games" },
    source: "UnifiedHeader nav",
  },
  {
    name: "arcade_match_history_views_total",
    type: "counter",
    description: "Finished-match history loads",
    defaultLabels: { result: "ok" },
    source: "history.listHistory",
  },
  {
    name: "arcade_match_history_errors_total",
    type: "counter",
    description: "Finished-match history query failures",
    defaultLabels: { reason: "query_failed" },
    source: "history.listHistory",
  },
  {
    name: "arcade_replay_loads_total",
    type: "counter",
    description: "Replay loads, successful or rejected",
    defaultLabels: { result: "ok", game: "tictactoe" },
    source: "history.replay",
  },
  {
    name: "arcade_replay_errors_total",
    type: "counter",
    description: "Replay failures by reason",
    defaultLabels: { reason: "incomplete", game: "tictactoe" },
    source: "history.replay",
  },
  {
    name: "arcade_replay_load_ms",
    type: "histogram",
    description: "Time to build a replay",
    defaultLabels: { result: "ok", game: "tictactoe" },
    source: "history.replay",
  },
  {
    name: "arcade_web_history_views_total",
    type: "counter",
    description: "History page loads from the web client",
    defaultLabels: { surface: "web", result: "ok" },
    source: "HistoryPage",
  },
  {
    name: "arcade_web_history_load_errors_total",
    type: "counter",
    description: "History page failed to load",
    defaultLabels: { surface: "web", result: "error" },
    source: "HistoryPage",
  },
  {
    name: "arcade_web_replay_loads_total",
    type: "counter",
    description: "Replay page loads from the web client",
    defaultLabels: { surface: "web", result: "ok" },
    source: "ReplayPage",
  },
  {
    name: "arcade_web_replay_load_errors_total",
    type: "counter",
    description: "Replay page failed to load",
    defaultLabels: { surface: "web", result: "error", reason: "incomplete" },
    source: "ReplayPage",
  },
  {
    name: "arcade_web_replay_load_ms",
    type: "histogram",
    description: "Time for the web client to load a replay",
    defaultLabels: { surface: "web", result: "ok" },
    source: "ReplayPage",
  },
  {
    name: "arcade_verify",
    type: "counter",
    description: "Observability probe / verify injections",
    defaultLabels: { probe_id: "admin", signal: "metrics" },
    source: "openobserve.verifyInjection",
  },
];

export function metricNames(): string[] {
  return METRICS_CATALOG.map((m) => m.name);
}

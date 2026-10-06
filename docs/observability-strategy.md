# Observability strategy — logs, metrics, traces

Branch: `plan/observability-strategy`  
Streams: `arcade_logs` · Prometheus-style metrics via `/ingest/metrics/_json` · `arcade_traces` (OTLP/HTTP)

## Goal

Every user-facing and admin **action** emits a correlated triad:

| Signal | Purpose | Correlation |
|--------|---------|-------------|
| **Log** | What happened (searchable facts) | `trace_id`, `span_id`, `event`, `user`, `game_id`, `match_id` |
| **Metric** | How often / how long / how many | Stable `__name__` + low-cardinality labels |
| **Trace** | Where time was spent (request → use-case → DB) | Same `trace_id`; child spans use `parent_span_id` |

Rule: **no orphan signals**. If an action writes a metric, it also writes a log and a span (or inherits the HTTP span as parent).

---

## What we have today

### Catalog metrics (`metrics-catalog.ts`)

| Metric | Type (catalog) | Emitted as | Labels | Source |
|--------|----------------|------------|--------|--------|
| `arcade_http_requests` | counter | counter | `method`, `route`, `status` | `finishRequest` |
| `arcade_http_duration_ms` | histogram | **gauge** (bug) | `method`, `route`, `status` | `finishRequest` |
| `arcade_events` | counter | counter | `event` | `auth.login`, `auth.register` only |
| `arcade_matches_total` | counter | counter | `game`, `result` | match start / end |
| `arcade_game_popularity` | counter | counter | `game` | match start |
| `arcade_moves_total` | counter | counter | `game`, `actor` | human / bot move |
| `arcade_verify` | counter | counter | `probe_id`, `signal` | verify endpoint |

### HTTP baseline (good)

Every `/api/*` request runs `startRequest` → `finishRequest`, which already emits:

- log: `METHOD route status` + `duration_ms` + `trace_id` / `span_id`
- metrics: `arcade_http_requests`, `arcade_http_duration_ms`
- trace: one SERVER span named `METHOD route`

### Domain coverage (uneven)

| Action | Log | Metric | Trace | Notes |
|--------|-----|--------|-------|-------|
| HTTP any `/api/*` | yes | yes | yes | Baseline |
| `auth.register` | yes | `arcade_events` | **no** | No span; register then login doubles metrics |
| `auth.login` | yes | `arcade_events` | yes | Span not parented under HTTP |
| `auth.logout` | yes | **no** | **no** | |
| `auth.me` | (HTTP only) | (HTTP only) | (HTTP only) | No domain event |
| `match.start` | yes | matches + popularity | yes | Not parented |
| `match.move` | **no** | moves | yes (`match.move`) | No log per move |
| `match.end` | yes | matches | yes | |
| `admin.insights` | yes | **no** | yes | |
| `admin.metric_inject` | yes | target only | **no** | Inject is metrics-only by design today |
| `observability.verify` | yes | yes | yes | Gold standard triad |
| Illegal move / auth fail | (HTTP error log) | **no** domain | (HTTP ERROR) | No `arcade_events` for failures |

### Structural gaps

1. **`ObservabilityPort.span` does not pass `parentSpanId`** — domain spans are siblings of the HTTP span, not children, so traces do not nest.
2. **`track()`** (log + metric, no span) exists but is unused; auth/games call `log` / `metric` / `span` separately and inconsistently.
3. **`arcade_http_duration_ms` type mismatch** — catalog says histogram, emit path uses `gauge`.
4. **Admin inject** only targets metrics; there is no “inject N of this *action*” that fans out to logs + traces.
5. **High-value product questions** (win rate by game over time, illegal-move rate, login failures, bot think time) are not first-class metrics yet.

---

## Target model: Action catalog

Introduce a single catalog (code + admin UI) of **actions**. Each row defines the triad.

### Naming

- Log `message` / field `event`: `domain.action` (e.g. `auth.login`, `match.move`)
- Metric names: `arcade_<noun>_<unit>` counters/histograms
- Span `name`: same as `event` for domain spans; HTTP stays `METHOD /api/...`
- Shared fields on every domain emission: `event`, `trace_id`, `user` (when known), `game_id` / `match_id` (when known)

### Required actions (phase 1 — close gaps)

| Action / event | Metric | Key labels | Log | Span |
|----------------|--------|------------|-----|------|
| `http.request` | `arcade_http_requests` + `arcade_http_duration_ms` | method, route, status | keep | keep (root) |
| `auth.register` | `arcade_events` | event=register, result=ok\|fail | yes | child of HTTP |
| `auth.login` | `arcade_events` | event=login, result=ok\|fail, role | yes | child |
| `auth.logout` | `arcade_events` | event=logout | yes | child |
| `auth.session_restore` | `arcade_events` | event=session_restore, result=hit\|miss | yes (info/debug) | child (optional) |
| `match.start` | `arcade_matches_total` + `arcade_game_popularity` | game, result=started | yes | child |
| `match.move` | `arcade_moves_total` | game, actor | yes (info) | child |
| `match.end` | `arcade_matches_total` | game, result=human_win\|bot_win\|draw | yes | child |
| `match.illegal` | `arcade_illegal_moves_total` **(new)** | game | yes (warn) | child, status=ERROR |
| `admin.insights` | `arcade_events` | event=admin_insights | yes | child |
| `admin.metric_inject` | `arcade_admin_injects_total` **(new)** + target samples | metric, count | yes | child |
| `observability.verify` | `arcade_verify` | probe_id, signal | yes | yes |

### Recommended additions (phase 2)

| Metric | Type | Labels | Why |
|--------|------|--------|-----|
| `arcade_auth_failures_total` | counter | reason=bad_password\|unknown_user | Security / abuse |
| `arcade_match_duration_ms` | histogram | game, result | How long games last |
| `arcade_bot_move_duration_ms` | histogram | game | Engine cost |
| `arcade_active_matches` | gauge | game | In-flight load |
| `arcade_scoreboard_views_total` | counter | — | Feature usage |
| `arcade_lobby_views_total` | counter | — | Feature usage (API `GET /api/games`) |
| `arcade_openobserve_export_errors_total` | counter | signal=logs\|metrics\|traces | Pipeline health |

Keep label cardinality low: **no** usernames, match ids, or free-text on metrics (those belong on logs/traces only).

---

## Ingestion strategy

### 1. One helper: `emitAction`

Replace ad-hoc `log` + `metric` + `span` calls with:

```ts
emitAction({
  event: "match.move",
  traceId, parentSpanId,
  user, gameId, matchId,
  metrics: [
    { name: "arcade_moves_total", value: 1, labels: { game, actor: "human" } },
  ],
  logLevel: "info",
  logFields: { actor: "human" },
  spanAttributes: { "game.id": gameId, "match.id": matchId },
});
```

Guarantees the triad and shared correlation fields.

### 2. Parent the tree

- Router: pass `ctx.traceId` + `ctx.spanId` into use-cases (already passes `traceId` in places).
- Extend `ObservabilityPort.span` with `parentSpanId`.
- Domain spans become children of the HTTP span → OpenObserve shows one request tree.

### 3. Fix types

- Emit `arcade_http_duration_ms` (and future duration metrics) as **histogram** (or document as gauge and change the catalog — prefer histogram for p95).
- Align admin inject `def.type` with actual emit type.

### 4. Admin inject → “signal inject”

Keep per-metric inject for load tests. Add:

- **Inject action**: pick an action from the catalog, N times → N logs + N metric samples + N spans (same as verify, but for any action).
- Or extend inject UI with checkboxes: Metrics / Logs / Traces.

### 5. Failure paths

On `AppError` paths that matter (401 login, illegal move), call `emitAction` with `result=fail` **before** returning, in addition to HTTP finishRequest. That fills `arcade_events` / new failure counters without waiting for log scraping.

### 6. Verification

- Keep `GET /api/observability/verify` as the canary.
- Add a lightweight admin “coverage” view: catalog actions × last-seen in OO (optional phase 3).

---

## Implementation order

1. **Contract** — `ACTION_CATALOG` + `emitAction` + parent span wiring (no new product metrics yet).
2. **Close gaps** — logout, register span, match.move log, illegal move, auth failure metrics; fix duration type.
3. **New metrics** — match/bot duration histograms, admin inject counter, lobby/scoreboard views.
4. **Admin UX** — show action catalog; inject triad; document label rules in the metrics table.
5. **Dashboards** (OpenObserve) — RED for HTTP; game popularity; win rate from `arcade_matches_total{result=*}`.

---

## Out of scope (for now)

- Browser RUM / frontend spans
- Sampling (volume is low; always-on is fine)
- Changing stream names (`arcade_logs` / `arcade_traces`)

---

## Success criteria

- [x] Every row in the action catalog has log + metric + trace in code paths that succeed and that fail for auth/illegal-move.
- [x] OpenObserve trace view shows `HTTP` → `match.move` (and siblings) under one `trace_id` via `parentSpanId`.
- [x] Admin portal lists metrics **and** actions; inject can exercise the triad (`POST /api/admin/actions/inject`).
- [x] Catalog types match emitted `__type__` values (`arcade_http_duration_ms` is histogram).

## Implemented (this branch)

- `emitAction` + `ACTIONS_CATALOG` + expanded `METRICS_CATALOG` (16 metrics).
- Auth / match / lobby / scoreboard / admin wired through `emitAction` with HTTP parent spans.
- New metrics: auth failures, illegal moves, match/bot duration, active matches, lobby/scoreboard views, admin injects, export errors.
- Admin UI **actions** tab for triad inject.

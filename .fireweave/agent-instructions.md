# FireWeave agent instructions (arcade)

This repo is FireWeave **rollout-ready** ("promote, not wrap"). Read this before any behaviour-changing feature work.

## Rollout-ready layout

| Artifact | Path |
| --- | --- |
| API harness | `apps/api/src/fireweave/fw-harness.ts` |
| API providers | `apps/api/src/fireweave/fw-providers.ts` |
| API tracker (`FW_STAMPS`) | `apps/api/src/fireweave/fw-tracker.ts` |
| Web harness | `apps/web/src/fireweave/fw-harness.ts` |
| Web providers | `apps/web/src/fireweave/fw-providers.ts` |
| Web tracker (`FW_STAMPS`) | `apps/web/src/fireweave/fw-tracker.ts` |
| Provider notes | `.fireweave/PROVIDERS.md` |
| Env contract (names only) | `fireweave.md` |
| Build gate | `.fireweave/hooks/rollout-build-gate.sh` |

**Rollout-ready manifests and change stamps are server-owned.** Author manifests with `mcp__rollout-server__upsert_rollout_manifest`. Do **not** create `.fireweave/rollout-ready/` or write manifest JSON files by hand.

Gitignored runtime paths: `.fireweave/.cache/` (projection — rebuild with `fw sync`), `.fireweave/.queue/` (unsynced author state — **never delete to clear a warning**), `.fireweave/.lock`, `.fireweave/local.json`.

Surfaces wired: **ts-server** (`apps/api`) and **web** (`apps/web`).

## How to emit a metric — ts-server (`apps/api`)

**Client:** custom OpenObserve helper (not OTel SDK). Recorded as `metricsClient: "openobserve"`.

**Import (as used in this repo):**

```ts
import { metric, emitAction } from "../infrastructure/observability/openobserve";
// or via the port:
import { observability } from "../infrastructure/observability/adapter";
```

**Call shapes:**

```ts
await metric("arcade_http_requests", 1, { method: "GET", route: "/api/health", status: "200" }, "counter");
await metric("arcade_http_duration_ms", elapsedMs, { method: "GET", route: "/api/health" }, "histogram");
```

Preferred product path: `deps.obs.emitAction({ event, metrics: [{ name, value, labels }] })` — see `apps/api/src/application/auth.ts`.

**Where the instrument comes from:** module singleton helpers in `openobserve.ts`; use-cases receive `ObservabilityPort` via DI from `bootstrap.ts`.

**Real example** (`apps/api/src/application/auth.ts` login success):

```ts
await deps.obs.emitAction({
  event: "auth.login",
  user: publicUser.username,
  metrics: [
    { name: "arcade_events", value: 1, labels: { event: "login", result: "ok", role: publicUser.role } },
  ],
});
```

**Label convention:** snake_case metric names prefixed `arcade_`; labels carry dimensions like `event`, `result`, `game`, `role`. Cohort for flag ramps is the **user id** passed as `targetingKey` on control-point reads (not a metric label).

### What this surface already emits

| Metric | Type | Where | Measures |
| --- | --- | --- | --- |
| `arcade_http_requests` | counter | `openobserve.finishRequest` | HTTP requests |
| `arcade_http_duration_ms` | histogram | `openobserve.finishRequest` | Request duration |
| `arcade_events` | counter | `emitAction` (auth/admin/…) | Product events |
| `arcade_auth_failures_total` | counter | `auth.login` / `auth.register` | Failed auth |
| `arcade_matches_total` | counter | games use-cases | Matches started/finished |
| `arcade_game_popularity` | counter | `games.getOrCreateMatch` | Game selection |
| `arcade_moves_total` | counter | `games.applyMove` | Moves |
| `arcade_illegal_moves_total` | counter | `games.applyMove` | Illegal moves |
| `arcade_match_duration_ms` | histogram | match end | Match length |
| `arcade_bot_move_duration_ms` | histogram | bot move | Bot think time |
| `arcade_active_matches` | gauge | match start/end | Active matches |
| `arcade_lobby_views_total` | counter | `games.listGames` | Lobby views |
| `arcade_scoreboard_views_total` | counter | scoreboard | Scoreboard loads |
| `arcade_openobserve_export_errors_total` | counter | export failures | Export errors |
| `arcade_verify` | counter | verify injection | Probe metrics |

Full catalog: `apps/api/src/infrastructure/observability/metrics-catalog.ts`.

## How to emit a metric — web (`apps/web`)

**Client:** browser helper that POSTs to the API OpenObserve proxy (never embeds OpenObserve secrets). Recorded as `metricsClient: "openobserve"`.

**Import:**

```ts
import { emitClientAction, metric } from "./observability/openobserve";
```

**Call shapes:**

```ts
await metric("arcade_web_lobby_views_total", 1, { surface: "web" });
await emitClientAction({
  event: "web.auth.login",
  user: next.username,
  metrics: [{ name: "arcade_web_events", value: 1, labels: { event: "login", result: "ok" } }],
});
```

**Where the instrument comes from:** module helpers in `apps/web/src/observability/openobserve.ts` → `POST /api/client-telemetry` → server `emitAction`.

**Real example** (`apps/web/src/Lobby.tsx`):

```ts
void emitClientAction({
  event: "web.lobby.view",
  metrics: [
    { name: "arcade_web_lobby_views_total", value: 1, labels: { surface: "web" } },
  ],
});
```

**Label convention:** metric names prefixed `arcade_web_`; always include `surface: "web"` when useful. Cohort for flag ramps is `syncFireweaveUser(user.id)` / `fw.controlPoints.getBooleanValue(key, false)` (sync reads after prefetch).

### What this surface already emits

| Metric | Type | Where | Measures |
| --- | --- | --- | --- |
| `arcade_web_events` | counter | auth login/register/logout, lobby | Web product events |
| `arcade_web_lobby_views_total` | counter | `LobbyPage` | Lobby page loads |
| `arcade_web_header_views_total` | counter | `UnifiedHeader` | Unified header shown |
| `arcade_web_header_nav_clicks_total` | counter | `UnifiedHeader` | Header nav clicks |

## Does this task qualify? — classify BEFORE step 1

| Class | Run the package? |
| --- | --- |
| **change** — modify observable runtime behaviour | **YES** |
| **inquiry** — explain / locate / review | no |
| **brainstorm** — nothing written yet | no (re-classify when writing starts) |
| **infra-only** — CI, docs, formatting, no behaviour delta | no |

When unclear, treat as **change**.

## Every feature change — HARD ORDER

1. **FIRST** — author the manifest via `mcp__rollout-server__upsert_rollout_manifest` `{ feature, manifest, baseContentHash }` (see Manifest contract below). Mint `chg_<ULID>` + `stmp_<ULID>`; append the stamp to `apps/api/src/fireweave/fw-tracker.ts` `FW_STAMPS`. FireWeave stores the manifest — do not write a manifest file.
2. Gate behaviour with `fw.controlPoints.getBooleanValue('<key>', false, { targetingKey: user.id })` and `// @fireweave-controlpoint <key>` at each eval site. Local ON → seed `makeDevProvider()` `local.controlPoints`, never `default: true`.
3. At each control point, decide stability/adoption signals (reuse / add / park) using this surface's metrics section.
4. Amend the manifest with those metrics (`baseContentHash` = prior `contentHash`).
5. **BEFORE done** — `assert_dev_checklist` `{ feature }` (PARK on block) + `detect_rollout_ready` + `reconcile` phase `build`.
6. Ship only via `/fireweave:safe-rollout`.

**Absence has names:** only `never-authored` means author now. `not-fetched` → `fw sync`; `not-authorized` → withheld; `queued` → drain `.fireweave/.queue/`; `server-unavailable` → retry.

## Do not

- Swap providers at promotion.
- Route telemetry through FireWeave.
- Gate `registerFwTarget` / identity behind a control point (INIT-S8).
- Write repo-local `mcp/rollout-server/` (Cursor plugin MCP only).
- Use `getBooleanValue(key, true)` for laptop dogfood.

## Cohort identity (always-on)

| Surface | Contract |
| --- | --- |
| **Server (`apps/api`)** | After successful login in `apps/api/src/application/auth.ts`, call `registerFwTarget(user.id, …)` unconditionally. Every `getBooleanValue` passes `{ targetingKey: user.id }` (or `resolveInstanceTargetingKey()` only when the server is the subject). |
| **Web (`apps/web`)** | After auth / session restore in `apps/web/src/auth.tsx`, call `syncFireweaveUser(String(user.id), …)`. On logout / 401 call `clearFireweaveUser()` so the next visitor does not inherit the previous bucket. |

## Manifest contract

Use the shape in the FireWeave initialise skill / Cursor rule: `schema: 1`, `flags.api: "control-points"`, `harness.surface: "ts-server"`, `harness.path: "apps/api/src/fireweave/fw-harness.ts"`, `rolloutCredentialEnv: "FW_PROJECT_API_KEY"`, `harness.posthogProjectId: "534542"`. Boolean flag defaults MUST be `false` (RAMP-1). Derive `telemetry.metrics` from the change — do not copy placeholder metric names.

## Ship

`/fireweave:safe-rollout` promotes existing rollout-ready work only.

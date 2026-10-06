# FireWeave providers (this repo)

| Tier | Environment | Flags | Telemetry |
| --- | --- | --- | --- |
| **dev** | `development` (`NODE_ENV` / Vite `MODE`) | FireWeave local in-memory provider | App-owned OpenObserve (API direct; web via `/api/client-telemetry`) |
| **prod** | `production` | FireWeave remote → fw-server | Same OpenObserve path |

- **API flags:** `FW_API_URL` + `FW_PROJECT_API_KEY` → `@fireweaveai/server-sdk`
- **Web flags:** `PUBLIC_FW_API_URL` + `PUBLIC_FW_PROJECT_API_KEY` → `@fireweaveai/web-sdk` (build-baked)
- **Observability query:** OpenObserve (server credentials only — never in the browser bundle)
- **Flag control (prod):** PostHog project `534542` via managed `fireweave-posthog`

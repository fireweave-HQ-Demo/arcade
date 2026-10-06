# FireWeave providers (this repo)

| Tier | Environment | Flags | Telemetry |
| --- | --- | --- | --- |
| **dev** | any non-`production` `NODE_ENV` (local compose uses `development`) | FireWeave local in-memory provider (`makeDevProvider`) | App-owned OpenObserve client — not wired by FireWeave |
| **prod** | `production` | FireWeave remote → fw-server `/v1/flags/evaluate` (`makeConnectedVendorProvider`) | Same OpenObserve export path the app already uses |

- **Flag control (prod):** connected PostHog project `534542` via FireWeave managed `fireweave-posthog`.
- **Observability query:** OpenObserve connection `0464eed3-44e3-4671-aa08-95e5cceb03e6` (fw-server query leg).
- **Env signal:** `NODE_ENV` (optional override `FW_ENV`).
- **Prod credentials:** `FW_API_URL` + `FW_PROJECT_API_KEY` in docker compose prod — see `fireweave.md`.

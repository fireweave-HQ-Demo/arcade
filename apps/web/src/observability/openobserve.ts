/**
 * Browser OpenObserve client — never holds OpenObserve credentials.
 * Emits via the API (`POST /api/client-telemetry`), which forwards with the
 * server-side OpenObserve helper.
 */
export type ClientMetric = {
  name: string;
  value?: number;
  labels?: Record<string, string>;
  type?: "counter" | "gauge" | "histogram";
};

export type ClientTelemetryInput = {
  event: string;
  user?: string;
  logLevel?: "debug" | "info" | "warn" | "error";
  logFields?: Record<string, unknown>;
  metrics?: ClientMetric[];
};

export async function emitClientAction(input: ClientTelemetryInput): Promise<void> {
  try {
    await fetch("/api/client-telemetry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      keepalive: true,
    });
  } catch {
    // Telemetry must never break UI flows.
  }
}

export async function metric(
  name: string,
  value = 1,
  labels: Record<string, string> = {},
  type: "counter" | "gauge" | "histogram" = "counter",
): Promise<void> {
  await emitClientAction({
    event: "web.metric",
    metrics: [{ name, value, labels, type }],
  });
}

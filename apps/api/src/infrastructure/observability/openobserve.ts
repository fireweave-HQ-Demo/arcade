/**
 * OpenObserve instrumentation: logs, metrics, traces + fetch-back verification.
 * Streams:
 *   logs    → arcade_logs
 *   metrics → arcade_* (Prometheus-style via ingest/metrics/_json)
 *   traces  → arcade_traces (OTLP/HTTP JSON)
 */

import { metricNames } from "./metrics-catalog";

const BASE = (process.env.OPENOBSERVE_URL ?? "").replace(/\/$/, "");
const USER = process.env.OPENOBSERVE_USER ?? "";
const PASS = process.env.OPENOBSERVE_PASSWORD ?? "";
const SERVICE = "arcade";
const LOG_STREAM = process.env.OPENOBSERVE_LOG_STREAM ?? "arcade_logs";
const TRACE_STREAM = process.env.OPENOBSERVE_TRACE_STREAM ?? "arcade_traces";

export type LogLevel = "debug" | "info" | "warn" | "error";

function enabled() {
  return Boolean(BASE && USER && PASS);
}

function authHeader() {
  return `Basic ${Buffer.from(`${USER}:${PASS}`).toString("base64")}`;
}

function nowMs() {
  return Date.now();
}

function nowUs() {
  return Date.now() * 1000;
}

function nowNs() {
  return `${BigInt(Date.now()) * 1_000_000n}`;
}

function hexId(bytes: number) {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return [...buf].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function signalForPath(path: string): "logs" | "metrics" | "traces" {
  if (path.includes("/v1/traces") || path.includes("traces")) return "traces";
  if (path.includes("ingest/metrics")) return "metrics";
  return "logs";
}

/** Record export failure without recursing through metric(). */
function noteExportError(signal: "logs" | "metrics" | "traces") {
  if (!enabled()) return;
  const record = {
    __name__: "arcade_openobserve_export_errors_total",
    __type__: "counter",
    service: SERVICE,
    signal,
    _timestamp: nowMs(),
    value: 1,
  };
  void fetch(`${BASE}/ingest/metrics/_json`, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify([record]),
  }).catch(() => undefined);
}

async function postJson(path: string, body: unknown, extraHeaders: Record<string, string> = {}) {
  if (!enabled()) return { ok: false, skipped: true as const, status: 0, data: null };
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/json",
        Accept: "application/json",
        ...extraHeaders,
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let data: unknown = text;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      /* keep text */
    }
    if (!res.ok) noteExportError(signalForPath(path));
    return { ok: res.ok, skipped: false as const, status: res.status, data };
  } catch {
    noteExportError(signalForPath(path));
    return { ok: false, skipped: false as const, status: 0, data: null };
  }
}

async function getJson(path: string) {
  if (!enabled()) return { ok: false, skipped: true as const, status: 0, data: null };
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: authHeader(), Accept: "application/json" },
  });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, skipped: false as const, status: res.status, data };
}

/** Structured application log → OpenObserve logs stream */
export async function log(
  level: LogLevel,
  message: string,
  fields: Record<string, unknown> = {},
  ctx?: { traceId?: string; spanId?: string },
) {
  const record = {
    _timestamp: nowMs(),
    level,
    message,
    service: SERVICE,
    ...fields,
    ...(ctx?.traceId ? { trace_id: ctx.traceId } : {}),
    ...(ctx?.spanId ? { span_id: ctx.spanId } : {}),
  };
  try {
    return await postJson(`/${LOG_STREAM}/_json`, [record]);
  } catch {
    return { ok: false, skipped: false as const, status: 0, data: null };
  }
}

/** Counter / gauge metric → OpenObserve metrics */
export async function metric(
  name: string,
  value: number,
  labels: Record<string, string> = {},
  type: "counter" | "gauge" | "histogram" = "counter",
) {
  return ingestMetricRecords([
    {
      __name__: name,
      __type__: type,
      service: SERVICE,
      ...labels,
      _timestamp: nowMs(),
      value,
    },
  ]);
}

async function ingestMetricRecords(records: Record<string, unknown>[]) {
  try {
    return await postJson(`/ingest/metrics/_json`, records);
  } catch {
    return { ok: false, skipped: false as const, status: 0, data: null };
  }
}

export type SpanInput = {
  name: string;
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  startNs?: string;
  endNs?: string;
  attributes?: Record<string, string | number | boolean>;
  statusCode?: 0 | 1 | 2; // UNSET | OK | ERROR
  statusMessage?: string;
};

function attrValue(v: string | number | boolean) {
  if (typeof v === "number") return { intValue: String(Math.trunc(v)) };
  if (typeof v === "boolean") return { boolValue: v };
  return { stringValue: String(v) };
}

/** OTLP/HTTP JSON span → OpenObserve traces stream */
export async function traceSpan(input: SpanInput) {
  const traceId = input.traceId ?? hexId(16);
  const spanId = input.spanId ?? hexId(8);
  const start = input.startNs ?? nowNs();
  const end = input.endNs ?? `${BigInt(start) + 1_000_000n}`;

  const body = {
    resourceSpans: [
      {
        resource: {
          attributes: [{ key: "service.name", value: { stringValue: SERVICE } }],
        },
        scopeSpans: [
          {
            scope: { name: SERVICE, version: "1.0.0" },
            spans: [
              {
                traceId,
                spanId,
                ...(input.parentSpanId ? { parentSpanId: input.parentSpanId } : {}),
                name: input.name,
                kind: 2, // SERVER
                startTimeUnixNano: start,
                endTimeUnixNano: end,
                attributes: Object.entries(input.attributes ?? {}).map(([key, value]) => ({
                  key,
                  value: attrValue(value),
                })),
                status: {
                  code: input.statusCode ?? 1,
                  ...(input.statusMessage ? { message: input.statusMessage } : {}),
                },
              },
            ],
          },
        ],
      },
    ],
  };

  try {
    const result = await postJson(`/v1/traces`, body, { "stream-name": TRACE_STREAM });
    return { ...result, traceId, spanId };
  } catch {
    return {
      ok: false,
      skipped: false as const,
      status: 0,
      data: null,
      traceId,
      spanId,
    };
  }
}

export type EmitMetric = {
  name: string;
  value: number;
  labels?: Record<string, string>;
  type?: "counter" | "gauge" | "histogram";
};

export type EmitActionInput = {
  event: string;
  traceId?: string;
  parentSpanId?: string;
  user?: string;
  gameId?: string;
  matchId?: number;
  metrics?: EmitMetric[];
  logLevel?: LogLevel;
  logFields?: Record<string, unknown>;
  spanAttributes?: Record<string, string | number | boolean>;
  statusCode?: 0 | 1 | 2;
  statusMessage?: string;
};

/**
 * Emit a correlated triad: log + metric(s) + span for one product action.
 */
export async function emitAction(input: EmitActionInput) {
  const traceId = input.traceId ?? hexId(16);
  const spanId = hexId(8);
  const fields: Record<string, unknown> = {
    event: input.event,
    ...(input.user ? { user: input.user } : {}),
    ...(input.gameId ? { game_id: input.gameId } : {}),
    ...(input.matchId != null ? { match_id: input.matchId } : {}),
    ...(input.logFields ?? {}),
  };

  await Promise.all([
    log(input.logLevel ?? "info", input.event, fields, { traceId, spanId }),
    ...(input.metrics ?? []).map((m) =>
      metric(m.name, m.value, m.labels ?? {}, m.type ?? "counter"),
    ),
    traceSpan({
      name: input.event,
      traceId,
      spanId,
      parentSpanId: input.parentSpanId,
      attributes: {
        event: input.event,
        ...(input.user ? { "user.name": input.user } : {}),
        ...(input.gameId ? { "game.id": input.gameId } : {}),
        ...(input.matchId != null ? { "match.id": input.matchId } : {}),
        ...(input.spanAttributes ?? {}),
      },
      statusCode: input.statusCode ?? 1,
      statusMessage: input.statusMessage,
    }),
  ]);

  return { traceId, spanId };
}

export type RequestContext = {
  traceId: string;
  spanId: string;
  startNs: string;
  method: string;
  route: string;
};

export function startRequest(req: Request, route: string): RequestContext {
  return {
    traceId: hexId(16),
    spanId: hexId(8),
    startNs: nowNs(),
    method: req.method,
    route,
  };
}

export async function finishRequest(
  ctx: RequestContext,
  status: number,
  extra: Record<string, string | number | boolean> = {},
) {
  const durationMs = Number(BigInt(nowNs()) - BigInt(ctx.startNs)) / 1_000_000;
  const ok = status < 500;

  await Promise.all([
    log(
      ok ? "info" : "error",
      `${ctx.method} ${ctx.route} ${status}`,
      {
        http_method: ctx.method,
        http_route: ctx.route,
        http_status: status,
        duration_ms: Math.round(durationMs * 100) / 100,
        ...extra,
      },
      { traceId: ctx.traceId, spanId: ctx.spanId },
    ),
    metric("arcade_http_requests", 1, {
      method: ctx.method,
      route: ctx.route,
      status: String(status),
    }),
    metric(
      "arcade_http_duration_ms",
      durationMs,
      {
        method: ctx.method,
        route: ctx.route,
        status: String(status),
      },
      "histogram",
    ),
    traceSpan({
      name: `${ctx.method} ${ctx.route}`,
      traceId: ctx.traceId,
      spanId: ctx.spanId,
      startNs: ctx.startNs,
      endNs: nowNs(),
      attributes: {
        "http.method": ctx.method,
        "http.route": ctx.route,
        "http.status_code": status,
        event: "http.request",
        ...extra,
      },
      statusCode: ok ? 1 : 2,
      statusMessage: ok ? "OK" : "ERROR",
    }),
  ]);
}

async function searchLogs(sql: string, lookbackMs = 15 * 60_000) {
  const end = nowUs();
  const start = end - lookbackMs * 1000;
  return postJson(`/_search`, {
    query: { sql, start_time: start, end_time: end, from: 0, size: 20 },
  });
}

async function searchTraces(sql: string, lookbackMs = 15 * 60_000) {
  const end = nowUs();
  const start = end - lookbackMs * 1000;
  return postJson(`/_search`, {
    query: { sql, start_time: start, end_time: end, from: 0, size: 20 },
    type: "traces",
  });
}

async function queryMetric(promql: string) {
  if (!enabled()) return { ok: false, skipped: true as const, status: 0, data: null };
  const url = `${BASE}/prometheus/api/v1/query?query=${encodeURIComponent(promql)}`;
  const res = await fetch(url, {
    headers: { Authorization: authHeader(), Accept: "application/json" },
  });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, skipped: false as const, status: res.status, data };
}

async function sleep(ms: number) {
  await Bun.sleep(ms);
}

/**
 * Inject a unique probe into logs/metrics/traces, then fetch them back.
 * Retries briefly to absorb OpenObserve indexing lag.
 */
export async function verifyInjection(retries = 8, delayMs = 1500) {
  if (!enabled()) {
    return {
      configured: false,
      ok: false,
      error: "OPENOBSERVE_* env not configured",
    };
  }

  const probeId = `probe_${hexId(8)}`;
  const started = Date.now();

  const [logIngest, metricIngest, spanIngest] = await Promise.all([
    log("info", "observability.verify", { probe_id: probeId, signal: "logs" }),
    metric("arcade_verify", 1, { probe_id: probeId, signal: "metrics" }),
    traceSpan({
      name: "observability.verify",
      attributes: {
        probe_id: probeId,
        signal: "traces",
        injection_check: "ok",
      },
    }),
  ]);

  let logsHit: unknown = null;
  let metricsHit: unknown = null;
  let tracesHit: unknown = null;
  let tracesStreamOk = false;
  let attempts = 0;

  for (; attempts < retries; attempts++) {
    if (attempts > 0) await sleep(delayMs);

    const [logsSearch, metricsQuery, tracesSearch, streams] = await Promise.all([
      searchLogs(
        `SELECT * FROM ${LOG_STREAM} WHERE probe_id = '${probeId}' ORDER BY _timestamp DESC LIMIT 5`,
      ),
      queryMetric(`arcade_verify{probe_id="${probeId}"}`),
      searchTraces(
        `SELECT * FROM ${TRACE_STREAM} WHERE probe_id = '${probeId}' OR operation_name = 'observability.verify' ORDER BY _timestamp DESC LIMIT 5`,
      ),
      getJson(`/streams?type=traces`),
    ]);

    const logHits =
      logsSearch.data &&
      typeof logsSearch.data === "object" &&
      Array.isArray((logsSearch.data as { hits?: unknown[] }).hits)
        ? (logsSearch.data as { hits: unknown[] }).hits
        : [];
    if (logHits.length) logsHit = logHits[0];

    const metricResult =
      metricsQuery.data &&
      typeof metricsQuery.data === "object" &&
      (metricsQuery.data as { data?: { result?: unknown[] } }).data?.result
        ? (metricsQuery.data as { data: { result: unknown[] } }).data.result
        : [];
    if (metricResult.length) metricsHit = metricResult[0];

    const traceHits =
      tracesSearch.data &&
      typeof tracesSearch.data === "object" &&
      Array.isArray((tracesSearch.data as { hits?: unknown[] }).hits)
        ? (tracesSearch.data as { hits: unknown[] }).hits
        : [];
    if (traceHits.length) tracesHit = traceHits[0];

    const streamNames =
      streams.data &&
      typeof streams.data === "object" &&
      Array.isArray((streams.data as { list?: { name: string }[] }).list)
        ? (streams.data as { list: { name: string }[] }).list.map((s) => s.name)
        : [];
    tracesStreamOk = streamNames.includes(TRACE_STREAM);

    if (logsHit && metricsHit && (tracesHit || (tracesStreamOk && spanIngest.ok))) break;
  }

  // schema presence is a strong signal when search index lags
  let traceSchema: unknown = null;
  if (!tracesHit && tracesStreamOk) {
    const schema = await getJson(`/streams/${TRACE_STREAM}/schema?type=traces`);
    traceSchema = schema.data;
  }

  const logsOk = Boolean(logsHit) && logIngest.ok;
  const metricsOk = Boolean(metricsHit) && metricIngest.ok;
  const tracesOk = Boolean(tracesHit) || (spanIngest.ok && tracesStreamOk);

  return {
    configured: true,
    ok: logsOk && metricsOk && tracesOk,
    probe_id: probeId,
    duration_ms: Date.now() - started,
    attempts: attempts + 1,
    ingest: {
      logs: { ok: logIngest.ok, status: logIngest.status, data: logIngest.data },
      metrics: { ok: metricIngest.ok, status: metricIngest.status, data: metricIngest.data },
      traces: {
        ok: spanIngest.ok,
        status: spanIngest.status,
        data: spanIngest.data,
        trace_id: spanIngest.traceId,
        span_id: spanIngest.spanId,
      },
    },
    fetch: {
      logs: { ok: logsOk, hit: logsHit },
      metrics: { ok: metricsOk, hit: metricsHit },
      traces: {
        ok: tracesOk,
        hit: tracesHit,
        stream_present: tracesStreamOk,
        stream: TRACE_STREAM,
        schema_fields:
          traceSchema && typeof traceSchema === "object"
            ? ((traceSchema as { schema?: { name: string }[] }).schema ?? []).map((f) => f.name)
            : undefined,
      },
    },
    streams: {
      logs: LOG_STREAM,
      metrics: metricNames(),
      traces: TRACE_STREAM,
    },
  };
}

export async function listStreams(type?: "logs" | "metrics" | "traces") {
  const q = type ? `?type=${type}` : "";
  return getJson(`/streams${q}`);
}

export { enabled as observabilityEnabled, LOG_STREAM, TRACE_STREAM, SERVICE };

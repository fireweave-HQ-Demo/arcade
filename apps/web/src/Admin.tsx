import { useEffect, useMemo, useState } from "react";
import {
  api,
  type AdminInsights,
  type MetricDef,
  type MetricsCatalog,
} from "./api";

type Tab = "insights" | "metrics";

export function AdminPage() {
  const [tab, setTab] = useState<Tab>("insights");

  return (
    <div className="admin-shell">
      <section className="panel">
        <div className="topbar">
          <div>
            <div className="status">admin portal</div>
            <p className="hint">
              insights across every game · top players · OpenObserve metric inject
            </p>
          </div>
          <div className="nav admin-tabs">
            <button
              type="button"
              className={`btn secondary ${tab === "insights" ? "active" : ""}`}
              onClick={() => setTab("insights")}
            >
              insights
            </button>
            <button
              type="button"
              className={`btn secondary ${tab === "metrics" ? "active" : ""}`}
              onClick={() => setTab("metrics")}
            >
              metrics inject
            </button>
          </div>
        </div>
      </section>

      {tab === "insights" ? <InsightsPanel /> : <MetricsPanel />}
    </div>
  );
}

function InsightsPanel() {
  const [data, setData] = useState<AdminInsights | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void api
      .adminInsights()
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, []);

  const maxPlays = useMemo(
    () => Math.max(1, ...(data?.popularity.map((p) => p.plays) ?? [1])),
    [data],
  );

  if (error) {
    return (
      <section className="panel">
        <p className="error">{error}</p>
      </section>
    );
  }
  if (!data) {
    return (
      <section className="panel">
        <p className="hint">loading insights…</p>
      </section>
    );
  }

  return (
    <>
      <section className="panel">
        <div className="status">overview</div>
        <div className="stats" style={{ marginTop: "1rem" }}>
          <div>
            <strong>{data.totals.plays}</strong>total plays
          </div>
          <div>
            <strong>{data.totals.plays24h}</strong>last 24h
          </div>
          <div>
            <strong>{data.totals.players}</strong>on leaderboard
          </div>
          <div>
            <strong>{data.favored?.name ?? "—"}</strong>most favoured
          </div>
        </div>
        {data.favored ? (
          <p className="hint" style={{ marginTop: "0.85rem" }}>
            players favour <strong>{data.favored.name}</strong> ({data.favored.plays} plays
            · {data.favored.plays24h} in 24h)
          </p>
        ) : null}
      </section>

      <section className="panel">
        <div className="status">game popularity</div>
        <div className="bars">
          {data.popularity.map((p) => (
            <div className="bar-row" key={p.gameId}>
              <span>{p.name}</span>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${(p.plays / maxPlays) * 100}%` }} />
              </div>
              <span>{p.plays}</span>
            </div>
          ))}
        </div>
        <h3 style={{ marginTop: "1.5rem" }}>outcomes by game</h3>
        <table className="data">
          <thead>
            <tr>
              <th>game</th>
              <th>human</th>
              <th>bot</th>
              <th>draw</th>
              <th>24h</th>
            </tr>
          </thead>
          <tbody>
            {data.popularity.map((p) => (
              <tr key={p.gameId}>
                <td>{p.name}</td>
                <td>{p.humanWins}</td>
                <td>{p.botWins}</td>
                <td>{p.draws}</td>
                <td>{p.plays24h}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel">
        <div className="status">top players</div>
        <p className="hint">global wins across all games</p>
        <table className="data" style={{ marginTop: "0.75rem" }}>
          <thead>
            <tr>
              <th>#</th>
              <th>player</th>
              <th>wins</th>
              <th>played</th>
              <th>draws</th>
              <th>losses</th>
            </tr>
          </thead>
          <tbody>
            {data.leaderboard.map((r, i) => (
              <tr key={r.username}>
                <td>{i + 1}</td>
                <td>{r.username}</td>
                <td>{r.wins}</td>
                <td>{r.played}</td>
                <td>{r.draws}</td>
                <td>{r.losses}</td>
              </tr>
            ))}
            {!data.leaderboard.length ? (
              <tr>
                <td colSpan={6}>no finished matches yet</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <section className="panel">
        <div className="status">recent matches</div>
        <table className="data" style={{ marginTop: "0.75rem" }}>
          <thead>
            <tr>
              <th>id</th>
              <th>user</th>
              <th>game</th>
              <th>result</th>
            </tr>
          </thead>
          <tbody>
            {data.recent.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.username}</td>
                <td>{r.gameId}</td>
                <td>{r.winner ?? r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}

function MetricsPanel() {
  const [catalog, setCatalog] = useState<MetricsCatalog | null>(null);
  const [error, setError] = useState("");
  const [injecting, setInjecting] = useState<MetricDef | null>(null);
  const [count, setCount] = useState("10");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");

  useEffect(() => {
    void api
      .adminMetrics()
      .then(setCatalog)
      .catch((e: Error) => setError(e.message));
  }, []);

  async function confirmInject() {
    if (!injecting || !catalog) return;
    const n = Math.floor(Number(count));
    if (!Number.isFinite(n) || n < 1 || n > catalog.maxInject) {
      setResult(`enter a count between 1 and ${catalog.maxInject}`);
      return;
    }
    setBusy(true);
    setResult("");
    try {
      const res = await api.injectMetric(injecting.name, n);
      setResult(
        res.ok
          ? `injected ${res.ingested}/${res.requested} × ${res.metric}`
          : `inject failed (status ${res.status}) — ingested ${res.ingested}`,
      );
      if (res.ok) setInjecting(null);
    } catch (e) {
      setResult(e instanceof Error ? e.message : "inject failed");
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <section className="panel">
        <p className="error">{error}</p>
      </section>
    );
  }
  if (!catalog) {
    return (
      <section className="panel">
        <p className="hint">loading metrics catalog…</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="topbar">
        <div>
          <div className="status">metrics in code</div>
          <p className="hint">
            OpenObserve {catalog.configured ? "connected" : "not configured"} · inject up to{" "}
            {catalog.maxInject} samples per tap
          </p>
        </div>
      </div>

      <table className="data metrics-table" style={{ marginTop: "1rem" }}>
        <thead>
          <tr>
            <th>metric</th>
            <th>type</th>
            <th>description</th>
            <th>source</th>
            <th>inject</th>
          </tr>
        </thead>
        <tbody>
          {catalog.metrics.map((m) => (
            <tr key={m.name}>
              <td>
                <code className="mono">{m.name}</code>
              </td>
              <td>{m.type}</td>
              <td>{m.description}</td>
              <td className="hint">{m.source}</td>
              <td>
                <button
                  type="button"
                  className="btn mint"
                  style={{ padding: "0.45rem 0.75rem" }}
                  onClick={() => {
                    setInjecting(m);
                    setCount("10");
                    setResult("");
                  }}
                >
                  inject
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {injecting ? (
        <div className="inject-dialog" role="dialog" aria-modal="true">
          <div className="inject-card">
            <div className="status">inject metric</div>
            <p className="hint" style={{ marginTop: "0.5rem" }}>
              <code className="mono">{injecting.name}</code> → OpenObserve
            </p>
            <label className="inject-label">
              how many times?
              <input
                type="number"
                min={1}
                max={catalog.maxInject}
                value={count}
                onChange={(e) => setCount(e.target.value)}
                autoFocus
              />
            </label>
            <p className="hint">
              labels:{" "}
              {Object.entries(injecting.defaultLabels)
                .map(([k, v]) => `${k}=${v}`)
                .join(", ") || "—"}
            </p>
            {result ? <p className={result.startsWith("injected") ? "hint" : "error"}>{result}</p> : null}
            <div className="row" style={{ marginTop: "0.75rem" }}>
              <button className="btn mint" disabled={busy} onClick={() => void confirmInject()}>
                {busy ? "injecting…" : "confirm inject"}
              </button>
              <button
                className="btn secondary"
                disabled={busy}
                onClick={() => {
                  setInjecting(null);
                  setResult("");
                }}
              >
                cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {result && !injecting ? <p className="hint" style={{ marginTop: "1rem" }}>{result}</p> : null}
    </section>
  );
}

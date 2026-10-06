import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { api, ApiError, type HistoryMatch, type Match, type Replay } from "./api";
import { fw } from "./fireweave/fw-harness";
import { GameBoard } from "./games/GameBoard";
import { GameMark } from "./games/logos";
import { OutcomeFX } from "./games/outcome";
import { metric as record } from "./observability/openobserve";

function resultLabel(winner: Match["winner"]) {
  if (winner === "human_win") return "you win";
  if (winner === "bot_win") return "bot wins";
  if (winner === "draw") return "draw";
  return "unfinished";
}

function actorLabel(actor: Replay["frames"][number]["actor"]) {
  if (actor === "human") return "you";
  if (actor === "bot") return "arcade bot";
  return "opening";
}

export function HistoryPage() {
  // @fireweave-controlpoint match-replay
  const enabled = fw.controlPoints.getBooleanValue("match-replay", false);
  const [matches, setMatches] = useState<HistoryMatch[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!enabled) return;
    void api
      .history()
      .then((body) => {
        setMatches(body.matches);
        void record("arcade_web_history_views_total", 1, {
          surface: "web",
          result: "ok",
        });
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "failed");
        void record("arcade_web_history_load_errors_total", 1, {
          surface: "web",
          result: "error",
          reason: err instanceof ApiError ? String(err.status) : "network",
        });
      });
  }, [enabled]);

  if (!enabled) return <Navigate to="/" replace />;

  return (
    <section className="panel">
      <h2>history</h2>
      <p className="hint">finished matches you can step through</p>
      {error ? <p className="error">{error}</p> : null}
      {matches && matches.length === 0 ? (
        <p className="hint">no finished matches yet — play one, then come back</p>
      ) : null}
      {matches && matches.length > 0 ? (
        <ul className="history-list">
          {matches.map((match) => (
            <li key={match.id}>
              <Link to={`/history/${match.id}`}>
                <span>
                  <GameMark id={match.gameId} />
                  <strong>{match.name}</strong>
                </span>
                <span>{resultLabel(match.winner)}</span>
                <time dateTime={match.createdAt}>
                  {new Date(match.createdAt).toLocaleString()}
                </time>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export function ReplayPage() {
  // @fireweave-controlpoint match-replay
  const enabled = fw.controlPoints.getBooleanValue("match-replay", false);
  const { matchId } = useParams();
  const id = Number(matchId);
  const [replay, setReplay] = useState<Replay | null>(null);
  const [error, setError] = useState("");
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!enabled || !Number.isInteger(id)) return;
    const started = performance.now();
    void api
      .replay(id)
      .then((body) => {
        setReplay(body);
        setStep(0);
        void record("arcade_web_replay_loads_total", 1, {
          surface: "web",
          result: "ok",
          game: body.gameId,
        });
        void record(
          "arcade_web_replay_load_ms",
          Math.round(performance.now() - started),
          { surface: "web", result: "ok", game: body.gameId },
          "histogram",
        );
      })
      .catch((err: unknown) => {
        const reason =
          err instanceof ApiError
            ? err.status === 409
              ? "incomplete"
              : String(err.status)
            : "network";
        setError(err instanceof Error ? err.message : "failed");
        void record("arcade_web_replay_load_errors_total", 1, {
          surface: "web",
          result: "error",
          reason,
        });
        void record(
          "arcade_web_replay_load_ms",
          Math.round(performance.now() - started),
          { surface: "web", result: "error" },
          "histogram",
        );
      });
  }, [enabled, id]);

  if (!enabled) return <Navigate to="/" replace />;
  if (!Number.isInteger(id)) return <Navigate to="/history" replace />;

  const frame = replay?.frames[step];
  const last = replay ? step === replay.frames.length - 1 : false;
  const board: Match | null =
    replay && frame
      ? {
          id: replay.id,
          gameId: replay.gameId,
          state: frame.state,
          status: last ? "finished" : "playing",
          winner: last ? replay.winner : null,
        }
      : null;
  const statusClass =
    last && replay?.winner === "human_win" ? "win" : last && replay?.winner === "bot_win" ? "lose" : "";

  return (
    <section className={`panel play-panel ${statusClass}`}>
      <div className="play-bar">
        {replay ? <GameMark id={replay.gameId} /> : null}
        <div className="play-title">
          <div className="status">{replay?.name ?? "replay"}</div>
          <p className="hint">
            {frame ? actorLabel(frame.actor) : error ? "" : "loading…"}
            {last && replay ? ` · ${resultLabel(replay.winner)}` : ""}
          </p>
        </div>
        <div className="row">
          <Link className="btn secondary" to="/history">
            history
          </Link>
          <button
            className="btn secondary"
            type="button"
            disabled={!replay || step === 0}
            onClick={() => setStep((current) => Math.max(0, current - 1))}
          >
            previous
          </button>
          <span className="hint">
            {replay ? `${step + 1} / ${replay.frames.length}` : "—"}
          </span>
          <button
            className="btn mint"
            type="button"
            disabled={!replay || last}
            onClick={() =>
              setStep((current) =>
                replay ? Math.min(replay.frames.length - 1, current + 1) : current,
              )
            }
          >
            next
          </button>
        </div>
      </div>
      {error ? <p className="error">{error}</p> : null}
      {board ? (
        <div className="play-fit" data-game={board.gameId} data-result={statusClass}>
          <OutcomeFX
            gameId={board.gameId}
            result={statusClass === "win" || statusClass === "lose" ? statusClass : ""}
          />
          <GameBoard match={board} busy onMove={() => {}} />
        </div>
      ) : null}
    </section>
  );
}

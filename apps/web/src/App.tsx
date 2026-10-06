import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  api,
  type AdminInsights,
  type GameInfo,
  type Match,
  type Scoreboard,
  type User,
} from "./api";

type View = "lobby" | "play" | "scoreboard" | "admin";

function Auth({ onAuth }: { onAuth: (u: User) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(mode: "login" | "register") {
    setBusy(true);
    setError("");
    try {
      const { user } =
        mode === "login"
          ? await api.login(username, password)
          : await api.register(username, password);
      onAuth(user);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <p className="hint">one login for every game · human vs arcade bot</p>
      <form
        className="auth-form"
        style={{ marginTop: "1rem" }}
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          void submit("login");
        }}
      >
        <label>
          username
          <input value={username} onChange={(e) => setUsername(e.target.value)} required minLength={3} />
        </label>
        <label>
          password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={4}
          />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <div className="row">
          <button className="btn mint" type="submit" disabled={busy}>log in</button>
          <button className="btn secondary" type="button" disabled={busy} onClick={() => void submit("register")}>
            create account
          </button>
        </div>
        <p className="hint">admin: admin / admin</p>
      </form>
    </section>
  );
}

function TicTacToeBoard({
  match,
  busy,
  onMove,
}: {
  match: Match;
  busy: boolean;
  onMove: (body: unknown) => void;
}) {
  const board = (match.state as { board: string[] }).board;
  const done = match.status !== "playing";
  return (
    <div className="board">
      {board.map((cell, i) => (
        <button
          key={i}
          className={`cell ${cell === "X" ? "x" : cell === "O" ? "o" : ""}`}
          disabled={busy || done || cell !== ""}
          onClick={() => onMove({ index: i })}
        >
          {cell}
        </button>
      ))}
    </div>
  );
}

function ConnectFourBoard({
  match,
  busy,
  onMove,
}: {
  match: Match;
  busy: boolean;
  onMove: (body: unknown) => void;
}) {
  const grid = (match.state as { grid: number[] }).grid;
  const done = match.status !== "playing";
  const rows = 6;
  const cols = 7;
  return (
    <div>
      <div className="c4-cols">
        {Array.from({ length: cols }, (_, c) => (
          <button
            key={c}
            className="btn secondary"
            style={{ padding: "0.35rem" }}
            disabled={busy || done}
            onClick={() => onMove({ column: c })}
          >
            ↓
          </button>
        ))}
      </div>
      <div className="board c4">
        {Array.from({ length: rows * cols }, (_, i) => {
          const v = grid[i] ?? 0;
          return (
            <div
              key={i}
              className={`cell ${v === 1 ? "p1" : v === 2 ? "p2" : "empty"}`}
              aria-label={`cell ${i}`}
            />
          );
        })}
      </div>
    </div>
  );
}

function RpsBoard({
  match,
  busy,
  onMove,
  onNew,
}: {
  match: Match;
  busy: boolean;
  onMove: (body: unknown) => void;
  onNew: () => void;
}) {
  const state = match.state as { human: string | null; bot: string | null };
  const done = match.status !== "playing";
  return (
    <div className="stack" style={{ maxWidth: "none" }}>
      <div className="rps-choices">
        {(["rock", "paper", "scissors"] as const).map((choice) => (
          <button
            key={choice}
            className="rps-pick"
            disabled={busy || done}
            onClick={() => onMove({ choice })}
          >
            {choice}
          </button>
        ))}
      </div>
      {state.human || state.bot ? (
        <p className="status">
          you: {state.human ?? "—"} · bot: {state.bot ?? "…"}
        </p>
      ) : (
        <p className="hint">pick your move</p>
      )}
      {done ? (
        <button className="btn mint" onClick={onNew} disabled={busy}>play again</button>
      ) : null}
    </div>
  );
}

function PlayView({
  game,
  onBack,
}: {
  game: GameInfo;
  onBack: () => void;
}) {
  const [match, setMatch] = useState<Match | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true);
    try {
      setMatch(await api.match(game.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
  }, [game.id]);

  async function move(body: unknown) {
    setBusy(true);
    setError("");
    try {
      setMatch(await api.move(game.id, body));
    } catch (e) {
      setError(e instanceof Error ? e.message : "move failed");
    } finally {
      setBusy(false);
    }
  }

  async function fresh() {
    setBusy(true);
    try {
      setMatch(await api.newMatch(game.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  const statusText = !match
    ? "loading…"
    : match.winner === "human_win"
      ? "you win"
      : match.winner === "bot_win"
        ? "arcade bot wins"
        : match.winner === "draw"
          ? "draw"
          : "your move";

  const statusClass =
    match?.winner === "human_win" ? "win" : match?.winner === "bot_win" ? "lose" : "";

  return (
    <section className="panel">
      <div className="topbar">
        <div>
          <div className="status">{game.name}</div>
          <p className="hint">{game.description}</p>
        </div>
        <div className="row">
          <button className="btn secondary" onClick={onBack}>lobby</button>
          <button className="btn mint" disabled={busy} onClick={() => void fresh()}>new game</button>
        </div>
      </div>
      <div style={{ marginTop: "1.25rem" }} className={`status ${statusClass}`}>{statusText}</div>
      <div style={{ marginTop: "1rem" }}>
        {match && game.id === "tictactoe" ? (
          <TicTacToeBoard match={match} busy={busy} onMove={move} />
        ) : null}
        {match && game.id === "connectfour" ? (
          <ConnectFourBoard match={match} busy={busy} onMove={move} />
        ) : null}
        {match && game.id === "rps" ? (
          <RpsBoard match={match} busy={busy} onMove={move} onNew={() => void fresh()} />
        ) : null}
      </div>
      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}

function Lobby({
  games,
  onPlay,
}: {
  games: GameInfo[];
  onPlay: (g: GameInfo) => void;
}) {
  return (
    <section className="panel">
      <div className="status">choose a game</div>
      <p className="hint">same account · same bot · scores roll up to one board</p>
      <div className="grid-cards">
        {games.map((g) => (
          <button key={g.id} className="game-card" onClick={() => onPlay(g)}>
            <h3>{g.name}</h3>
            <p>{g.description}</p>
            <span className="badge">vs arcade bot</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function ScoreboardView() {
  const [data, setData] = useState<Scoreboard | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void api
      .scoreboard()
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <section className="panel"><p className="error">{error}</p></section>;
  if (!data) return <section className="panel"><p className="hint">loading scoreboard…</p></section>;

  return (
    <section className="panel">
      <div className="status">your scoreboard</div>
      <div className="stats" style={{ marginTop: "1rem" }}>
        <div><strong>{data.me.global.played}</strong>played</div>
        <div><strong>{data.me.global.wins}</strong>wins</div>
        <div><strong>{data.me.global.draws}</strong>draws</div>
        <div><strong>{data.me.global.losses}</strong>losses</div>
      </div>
      <h3 style={{ marginTop: "1.5rem" }}>by game</h3>
      <table className="data">
        <thead>
          <tr><th>game</th><th>played</th><th>wins</th><th>draws</th><th>losses</th></tr>
        </thead>
        <tbody>
          {data.me.byGame.map((r) => (
            <tr key={r.gameId}>
              <td>{r.gameId}</td>
              <td>{r.played}</td>
              <td>{r.wins}</td>
              <td>{r.draws}</td>
              <td>{r.losses}</td>
            </tr>
          ))}
          {!data.me.byGame.length ? (
            <tr><td colSpan={5}>no finished matches yet</td></tr>
          ) : null}
        </tbody>
      </table>
      <h3 style={{ marginTop: "1.5rem" }}>leaderboard</h3>
      <table className="data">
        <thead>
          <tr><th>player</th><th>wins</th><th>played</th></tr>
        </thead>
        <tbody>
          {data.leaderboard.map((r) => (
            <tr key={r.username}>
              <td>{r.username}</td>
              <td>{r.wins}</td>
              <td>{r.played}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function AdminView() {
  const [data, setData] = useState<AdminInsights | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void api
      .adminInsights()
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  const maxPlays = useMemo(
    () => Math.max(1, ...(data?.popularity.map((p) => p.plays) ?? [1])),
    [data],
  );

  if (error) return <section className="panel"><p className="error">{error}</p></section>;
  if (!data) return <section className="panel"><p className="hint">loading insights…</p></section>;

  return (
    <section className="panel">
      <div className="status">admin · game popularity</div>
      <div className="stats" style={{ marginTop: "1rem" }}>
        <div><strong>{data.totals.plays}</strong>total plays</div>
        <div><strong>{data.totals.plays24h}</strong>last 24h</div>
      </div>
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
      <h3 style={{ marginTop: "1.5rem" }}>outcomes</h3>
      <table className="data">
        <thead>
          <tr><th>game</th><th>human</th><th>bot</th><th>draw</th><th>24h</th></tr>
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
      <h3 style={{ marginTop: "1.5rem" }}>recent matches</h3>
      <table className="data">
        <thead>
          <tr><th>id</th><th>user</th><th>game</th><th>result</th></tr>
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
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("lobby");
  const [games, setGames] = useState<GameInfo[]>([]);
  const [active, setActive] = useState<GameInfo | null>(null);

  useEffect(() => {
    void api
      .me()
      .then(({ user }) => setUser(user))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!user) return;
    void api.games().then((r) => setGames(r.games));
  }, [user]);

  return (
    <main className="app">
      <h1 className="brand">
        <span>arcade</span>
      </h1>
      <p className="tagline">
        multi-game centre — human vs arcade bot, shared login, one scoreboard, full traces.
      </p>

      {loading ? (
        <section className="panel"><p className="hint">checking session…</p></section>
      ) : !user ? (
        <Auth onAuth={setUser} />
      ) : (
        <>
          <div className="topbar">
            <p className="hint">
              signed in as <strong>{user.username}</strong>
              {user.role === "admin" ? " · admin" : ""}
            </p>
            <button
              className="btn secondary"
              onClick={() => void api.logout().then(() => setUser(null))}
            >
              log out
            </button>
          </div>
          <nav className="nav">
            <button
              className={`btn secondary ${view === "lobby" || view === "play" ? "active" : ""}`}
              onClick={() => {
                setView("lobby");
                setActive(null);
              }}
            >
              games
            </button>
            <button
              className={`btn secondary ${view === "scoreboard" ? "active" : ""}`}
              onClick={() => setView("scoreboard")}
            >
              scoreboard
            </button>
            {user.role === "admin" ? (
              <button
                className={`btn secondary ${view === "admin" ? "active" : ""}`}
                onClick={() => setView("admin")}
              >
                admin
              </button>
            ) : null}
          </nav>

          {view === "lobby" && !active ? (
            <Lobby
              games={games}
              onPlay={(g) => {
                setActive(g);
                setView("play");
              }}
            />
          ) : null}
          {view === "play" && active ? (
            <PlayView
              game={active}
              onBack={() => {
                setActive(null);
                setView("lobby");
              }}
            />
          ) : null}
          {view === "scoreboard" ? <ScoreboardView /> : null}
          {view === "admin" ? <AdminView /> : null}
        </>
      )}
    </main>
  );
}

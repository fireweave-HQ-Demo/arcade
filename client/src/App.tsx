import { useEffect, useState, type FormEvent } from "react";
import { api, type Game, type Stats, type User } from "./api";

function Auth({ onAuth }: { onAuth: (user: User) => void }) {
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

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void submit("login");
  }

  return (
    <section className="panel">
      <form className="auth-form" onSubmit={onSubmit}>
        <label>
          username
          <input
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={3}
          />
        </label>
        <label>
          password
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={4}
          />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <div className="row">
          <button className="btn mint" type="submit" disabled={busy}>
            log in
          </button>
          <button
            className="btn secondary"
            type="button"
            disabled={busy}
            onClick={() => void submit("register")}
          >
            create account
          </button>
        </div>
      </form>
    </section>
  );
}

function BoardView({
  game,
  onMove,
  busy,
}: {
  game: Game;
  onMove: (i: number) => void;
  busy: boolean;
}) {
  const finished = game.status !== "playing";
  return (
    <div className="board" role="grid" aria-label="tic tac toe board">
      {game.board.map((cell, i) => (
        <button
          key={i}
          className={`cell ${cell === "X" ? "x" : cell === "O" ? "o" : ""}`}
          disabled={busy || finished || cell !== ""}
          onClick={() => onMove(i)}
          aria-label={`cell ${i + 1}`}
        >
          {cell}
        </button>
      ))}
    </div>
  );
}

function GameScreen({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [game, setGame] = useState<Game | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const [g, s] = await Promise.all([api.game(), api.stats()]);
    setGame(g);
    setStats(s);
  }

  useEffect(() => {
    void refresh().catch((e) => setError(e.message));
  }, []);

  async function move(index: number) {
    if (!game || busy) return;
    setBusy(true);
    setError("");
    try {
      const next = await api.move(index);
      setGame(next);
      setStats(await api.stats());
    } catch (e) {
      setError(e instanceof Error ? e.message : "move failed");
    } finally {
      setBusy(false);
    }
  }

  async function newGame() {
    setBusy(true);
    setError("");
    try {
      setGame(await api.newGame());
      setStats(await api.stats());
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  const statusText = !game
    ? "loading…"
    : game.winner === "X"
      ? "you win — rare!"
      : game.winner === "O"
        ? "temp-battle bot wins"
        : game.winner === "draw"
          ? "draw"
          : "your move (X)";

  const statusClass =
    game?.winner === "X" ? "win" : game?.winner === "O" ? "lose" : "";

  return (
    <section className="panel">
      <div className="topbar">
        <div>
          <div className="status">playing as {user.username}</div>
          <p className="hint">you are X · temp-battle bot is O · perfect minimax</p>
        </div>
        <button
          className="btn secondary"
          onClick={() => {
            void api.logout().then(onLogout);
          }}
        >
          log out
        </button>
      </div>

      {stats ? (
        <div className="stats" style={{ marginTop: "1.25rem" }}>
          <div>
            <strong>{stats.played}</strong>
            played
          </div>
          <div>
            <strong>{stats.wins}</strong>
            wins
          </div>
          <div>
            <strong>{stats.draws}</strong>
            draws
          </div>
          <div>
            <strong>{stats.losses}</strong>
            losses
          </div>
        </div>
      ) : null}

      <div className="board-wrap">
        <div className={`status ${statusClass}`}>{statusText}</div>
        {game ? <BoardView game={game} onMove={move} busy={busy} /> : null}
        {error ? <p className="error">{error}</p> : null}
        <button className="btn mint" disabled={busy} onClick={() => void newGame()}>
          new game
        </button>
      </div>
    </section>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void api
      .me()
      .then(({ user }) => setUser(user))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="app">
      <h1 className="brand">
        temp-<span>battle</span>
      </h1>
      <p className="tagline">
        lightweight tic-tac-toe against an unbeatable bot. sessions persist across
        reloads.
      </p>
      {loading ? (
        <section className="panel">
          <p className="hint">checking session…</p>
        </section>
      ) : user ? (
        <GameScreen user={user} onLogout={() => setUser(null)} />
      ) : (
        <Auth onAuth={setUser} />
      )}
    </main>
  );
}

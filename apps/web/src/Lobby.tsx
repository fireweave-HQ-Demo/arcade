import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, type GameInfo } from "./api";
import { GameCover } from "./games/covers";
import { CATEGORIES, inCategory, metaFor, type GameCategory } from "./games/meta";

const HOT_IDS = ["connectfour", "tictactoe", "gomoku", "reversi", "memory", "nim"];
const QUICK_IDS = ["tictactoe", "popout", "wildttt", "subtractsquare", "memory", "miserettt"];
const BRAIN_IDS = ["gomoku", "mancala", "orderchaos", "sos", "hexapawn", "dotsboxes"];

function byIds(games: GameInfo[], ids: string[]) {
  const map = new Map(games.map((g) => [g.id, g]));
  return ids.map((id) => map.get(id)).filter((g): g is GameInfo => Boolean(g));
}

function GameTile({
  game,
  size = "md",
  delay = 0,
}: {
  game: GameInfo;
  size?: "sm" | "md" | "lg" | "hero";
  delay?: number;
}) {
  const meta = metaFor(game.id);
  return (
    <Link
      to={`/play/${game.id}`}
      className={`tile tile-${size}`}
      style={{ animationDelay: `${delay}ms`, ["--tile-from" as string]: meta.from, ["--tile-to" as string]: meta.to }}
    >
      <div className="tile-art">
        <GameCover id={game.id} />
        <span className="tile-play">Play</span>
      </div>
      <div className="tile-meta">
        <h3>{game.name}</h3>
        {size === "hero" || size === "lg" ? <p>{meta.blurb}</p> : null}
      </div>
    </Link>
  );
}

function Rail({ title, games, size = "sm" }: { title: string; games: GameInfo[]; size?: "sm" | "md" }) {
  if (!games.length) return null;
  return (
    <section className="lobby-rail">
      <div className="rail-head">
        <h2>{title}</h2>
      </div>
      <div className="rail-track">
        {games.map((g, i) => (
          <GameTile key={g.id} game={g} size={size} delay={i * 35} />
        ))}
      </div>
    </section>
  );
}

export function LobbyPage() {
  const [games, setGames] = useState<GameInfo[]>([]);
  const [error, setError] = useState("");
  const [cat, setCat] = useState<GameCategory>("all");

  useEffect(() => {
    void api
      .games()
      .then((r) => setGames(r.games))
      .catch((e: Error) => setError(e.message));
  }, []);

  const featured = useMemo(() => games.slice(0, 3), [games]);
  const filtered = useMemo(() => games.filter((g) => inCategory(g.id, cat)), [games, cat]);
  const hot = useMemo(() => byIds(games, HOT_IDS), [games]);
  const quick = useMemo(() => byIds(games, QUICK_IDS), [games]);
  const brain = useMemo(() => byIds(games, BRAIN_IDS), [games]);

  if (error) {
    return (
      <section className="lobby">
        <p className="error">{error}</p>
      </section>
    );
  }

  return (
    <section className="lobby">
      <div className="lobby-hero">
        <div className="lobby-hero-copy">
          <p className="lobby-kicker">Free board games</p>
          <h1>arcade</h1>
          <p className="lobby-lead">
            Pick a title, beat the bot, climb the board — no downloads, just play.
          </p>
          {featured[0] ? (
            <Link className="btn mint lobby-cta" to={`/play/${featured[0].id}`}>
              Play {featured[0].name}
            </Link>
          ) : null}
        </div>
        <div className="lobby-featured">
          {featured.map((g, i) => (
            <GameTile key={g.id} game={g} size={i === 0 ? "hero" : "lg"} delay={i * 60} />
          ))}
          {!featured.length ? <p className="hint">loading games…</p> : null}
        </div>
      </div>

      <div className="lobby-cats" role="tablist" aria-label="Game categories">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={cat === c.id}
            className={`cat-chip ${cat === c.id ? "active" : ""}`}
            onClick={() => setCat(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>

      {cat === "all" ? (
        <>
          <Rail title="Can't stop playing" games={hot} size="md" />
          <Rail title="5-minute fun" games={quick} size="sm" />
          <Rail title="Train your brain" games={brain} size="sm" />
        </>
      ) : null}

      <section className="lobby-rail">
        <div className="rail-head">
          <h2>{cat === "all" ? "All games" : CATEGORIES.find((c) => c.id === cat)?.label}</h2>
          <span className="rail-count">{filtered.length} titles</span>
        </div>
        <div className="lobby-grid">
          {filtered.map((g, i) => (
            <GameTile key={g.id} game={g} size="md" delay={i * 30} />
          ))}
          {!filtered.length && games.length ? <p className="hint">no games in this category</p> : null}
          {!games.length ? <p className="hint">loading games…</p> : null}
        </div>
      </section>
    </section>
  );
}

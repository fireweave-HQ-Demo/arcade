import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError, api, type GameInfo } from "./api";
import { fw } from "./fireweave/fw-harness";
import { GameCover } from "./games/covers";
import { CATEGORIES, inCategory, metaFor, type GameCategory } from "./games/meta";
import { emitClientAction, metric } from "./observability/openobserve";

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
  pinsOn = false,
  pinned = false,
  onPin,
}: {
  game: GameInfo;
  size?: "sm" | "md" | "lg" | "hero";
  delay?: number;
  pinsOn?: boolean;
  pinned?: boolean;
  onPin?: (gameId: string) => void;
}) {
  const meta = metaFor(game.id);
  return (
    <div className="tile-slot">
      {pinsOn ? (
        <button
          type="button"
          className={`pin-btn ${pinned ? "on" : ""}`}
          onClick={() => onPin?.(game.id)}
        >
          {pinned ? "Unpin" : "Pin"}
        </button>
      ) : null}
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
    </div>
  );
}

function Rail({
  title,
  games,
  size = "sm",
  pinsOn = false,
  pinnedIds,
  onPin,
}: {
  title: string;
  games: GameInfo[];
  size?: "sm" | "md";
  pinsOn?: boolean;
  pinnedIds?: Set<string>;
  onPin?: (gameId: string) => void;
}) {
  if (!games.length) return null;
  return (
    <section className="lobby-rail">
      <div className="rail-head">
        <h2>{title}</h2>
      </div>
      <div className="rail-track">
        {games.map((g, i) => (
          <GameTile
            key={g.id}
            game={g}
            size={size}
            delay={i * 35}
            pinsOn={pinsOn}
            pinned={pinnedIds?.has(g.id)}
            onPin={onPin}
          />
        ))}
      </div>
    </section>
  );
}

export function LobbyPage() {
  const [games, setGames] = useState<GameInfo[]>([]);
  const [error, setError] = useState("");
  const [pinError, setPinError] = useState("");
  const [pinIds, setPinIds] = useState<string[]>([]);
  const [cat, setCat] = useState<GameCategory>("all");
  // @fireweave-controlpoint pin-games
  const pinsOn = fw.controlPoints.getBooleanValue("pin-games", false);

  useEffect(() => {
    void api
      .games()
      .then((r) => {
        setGames(r.games);
        void emitClientAction({
          event: "web.lobby.view",
          metrics: [
            { name: "arcade_web_lobby_views_total", value: 1, labels: { surface: "web" } },
            { name: "arcade_web_events", value: 1, labels: { event: "lobby_view", result: "ok" } },
          ],
        });
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!pinsOn) return;
    void api
      .pins()
      .then((r) => setPinIds(r.gameIds))
      .catch((e: Error) => setPinError(e.message));
  }, [pinsOn]);

  const pinnedSet = useMemo(() => new Set(pinIds), [pinIds]);

  async function togglePin(gameId: string) {
    setPinError("");
    try {
      const next = pinnedSet.has(gameId) ? await api.unpin(gameId) : await api.pin(gameId);
      setPinIds(next.gameIds);
      void metric("arcade_web_pins_total", 1, { surface: "web", result: "ok" });
    } catch (e) {
      const reason = e instanceof ApiError && e.code ? e.code : "request_failed";
      setPinError(e instanceof Error ? e.message : "pin failed");
      void metric("arcade_web_pin_errors_total", 1, { surface: "web", reason });
    }
  }

  const featured = useMemo(() => games.slice(0, 3), [games]);
  const pinnedGames = useMemo(() => byIds(games, pinIds), [games, pinIds]);
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
            <GameTile
              key={g.id}
              game={g}
              size={i === 0 ? "hero" : "lg"}
              delay={i * 60}
              pinsOn={pinsOn}
              pinned={pinnedSet.has(g.id)}
              onPin={(id) => void togglePin(id)}
            />
          ))}
          {!featured.length ? <p className="hint">loading games…</p> : null}
        </div>
      </div>

      {pinsOn ? (
        <>
          {pinError ? <p className="error">{pinError}</p> : null}
          {pinnedGames.length ? (
            <Rail
              title="Pinned"
              games={pinnedGames}
              size="md"
              pinsOn
              pinnedIds={pinnedSet}
              onPin={(id) => void togglePin(id)}
            />
          ) : (
            <p className="hint">Pin a game to keep it here. Up to 6.</p>
          )}
        </>
      ) : null}

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
          <Rail title="Can't stop playing" games={hot} size="md" pinsOn={pinsOn} pinnedIds={pinnedSet} onPin={(id) => void togglePin(id)} />
          <Rail title="5-minute fun" games={quick} size="sm" pinsOn={pinsOn} pinnedIds={pinnedSet} onPin={(id) => void togglePin(id)} />
          <Rail title="Train your brain" games={brain} size="sm" pinsOn={pinsOn} pinnedIds={pinnedSet} onPin={(id) => void togglePin(id)} />
        </>
      ) : null}

      <section className="lobby-rail">
        <div className="rail-head">
          <h2>{cat === "all" ? "All games" : CATEGORIES.find((c) => c.id === cat)?.label}</h2>
          <span className="rail-count">{filtered.length} titles</span>
        </div>
        <div className="lobby-grid">
          {filtered.map((g, i) => (
            <GameTile
              key={g.id}
              game={g}
              size="md"
              delay={i * 30}
              pinsOn={pinsOn}
              pinned={pinnedSet.has(g.id)}
              onPin={(id) => void togglePin(id)}
            />
          ))}
          {!filtered.length && games.length ? <p className="hint">no games in this category</p> : null}
          {!games.length ? <p className="hint">loading games…</p> : null}
        </div>
      </section>
    </section>
  );
}

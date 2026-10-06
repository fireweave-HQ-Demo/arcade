import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { Match } from "../api";

function fit(cols: number, rows: number): CSSProperties {
  return { "--cols": String(cols), "--rows": String(rows) } as CSSProperties;
}

/** Indices whose value changed since the previous render — drives place/drop/flip motion. */
function useFresh(values: string[]) {
  const key = values.join("\u0001");
  const prev = useRef<string | null>(null);
  const fresh = new Set<number>();
  if (prev.current !== null && prev.current !== key) {
    const old = prev.current.split("\u0001");
    values.forEach((v, i) => {
      if (old[i] !== v) fresh.add(i);
    });
  }
  useEffect(() => {
    prev.current = key;
  }, [key]);
  return fresh;
}

type Props = {
  match: Match;
  busy: boolean;
  onMove: (body: unknown) => void;
};

export function GameBoard({ match, busy, onMove }: Props) {
  const state = match.state as { kind?: string; board?: string[]; grid?: number[] };
  const done = match.status !== "playing";

  if (match.gameId === "tictactoe" || (!state.kind && state.board)) {
    return <CellBoard cells={state.board ?? []} cols={3} busy={busy} done={done} onMove={onMove} />;
  }
  if (match.gameId === "connectfour" || (!state.kind && state.grid)) {
    return (
      <DropBoard
        grid={(state as { grid: number[] }).grid}
        rows={6}
        cols={7}
        busy={busy}
        done={done}
        onMove={onMove}
      />
    );
  }

  switch (state.kind) {
    case "cells":
      return (
        <CellBoard
          cells={(state as { cells: string[] }).cells}
          cols={(state as { cols: number }).cols}
          busy={busy}
          done={done}
          onMove={onMove}
        />
      );
    case "drop":
      return (
        <DropBoard
          grid={(state as { grid: number[] }).grid}
          rows={(state as { rows: number }).rows}
          cols={(state as { cols: number }).cols}
          busy={busy}
          done={done}
          onMove={onMove}
        />
      );
    case "wild":
    case "sos":
    case "orderchaos":
      return <MarkBoard match={match} busy={busy} done={done} onMove={onMove} />;
    case "heaps":
      return <HeapsBoard match={match} busy={busy} done={done} onMove={onMove} />;
    case "number":
      return <NumberBoard match={match} busy={busy} done={done} onMove={onMove} />;
    case "reversi":
      return <ReversiBoard match={match} busy={busy} done={done} onMove={onMove} />;
    case "hexapawn":
      return <HexapawnBoard match={match} busy={busy} done={done} onMove={onMove} />;
    case "mancala":
      return <MancalaBoard match={match} busy={busy} done={done} onMove={onMove} />;
    case "memory":
      return <MemoryBoard match={match} busy={busy} done={done} onMove={onMove} />;
    case "boxes":
      return <BoxesBoard match={match} busy={busy} done={done} onMove={onMove} />;
    default:
      return <p className="error">unsupported board</p>;
  }
}

function CellBoard({
  cells,
  cols,
  busy,
  done,
  onMove,
}: {
  cells: string[];
  cols: number;
  busy: boolean;
  done: boolean;
  onMove: (body: unknown) => void;
}) {
  const fresh = useFresh(cells);
  return (
    <div className="board" style={fit(cols, Math.ceil(cells.length / cols))}>
      {cells.map((cell, i) => (
        <button
          key={i}
          className={`cell ${cell === "X" || cell === "S" ? "x" : cell === "O" ? "o" : ""} ${fresh.has(i) && cell ? "fresh" : ""}`}
          disabled={busy || done || cell !== ""}
          onClick={() => onMove({ index: i })}
        >
          {cell}
        </button>
      ))}
    </div>
  );
}

function DropBoard({
  grid,
  rows,
  cols,
  busy,
  done,
  onMove,
}: {
  grid: number[];
  rows: number;
  cols: number;
  busy: boolean;
  done: boolean;
  onMove: (body: unknown) => void;
}) {
  const fresh = useFresh(grid.map(String));
  return (
    <div className="drop-stack" style={fit(cols, rows)}>
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
      <div
        className="board"
      >
        {Array.from({ length: rows * cols }, (_, i) => {
          const v = grid[i] ?? 0;
          return (
            <div
              key={i}
              className={`cell ${v === 1 ? "p1" : v === 2 ? "p2" : "empty"} ${fresh.has(i) && v ? "fresh gravity" : ""}`}
              aria-label={`cell ${i}`}
            />
          );
        })}
      </div>
    </div>
  );
}

function MarkBoard({
  match,
  busy,
  done,
  onMove,
}: {
  match: Match;
  busy: boolean;
  done: boolean;
  onMove: (body: unknown) => void;
}) {
  const state = match.state as { kind: string; cols: number; cells: string[]; scores?: { human: number; bot: number } };
  const marks =
    state.kind === "sos" ? (["S", "O"] as const) : (["X", "O"] as const);
  const [mark, setMark] = useState<(typeof marks)[number]>(marks[0]);
  const fresh = useFresh(state.cells);

  return (
    <div className="stack" style={{ maxWidth: "none" }}>
      {state.scores ? (
        <p className="hint">
          score · you {state.scores.human} · bot {state.scores.bot}
        </p>
      ) : null}
      <div className="row">
        {marks.map((m) => (
          <button
            key={m}
            type="button"
            className={`btn secondary ${mark === m ? "active" : ""}`}
            onClick={() => setMark(m)}
          >
            place {m}
          </button>
        ))}
      </div>
      <div
        className="board"
        style={fit(state.cols, Math.ceil(state.cells.length / state.cols))}
      >
        {state.cells.map((cell, i) => (
          <button
            key={i}
            className={`cell ${cell === "X" || cell === "S" ? "x" : cell === "O" ? "o" : ""} ${fresh.has(i) && cell ? "fresh" : ""}`}
            disabled={busy || done || cell !== ""}
            onClick={() => onMove({ index: i, mark })}
          >
            {cell}
          </button>
        ))}
      </div>
    </div>
  );
}

function HeapsBoard({
  match,
  busy,
  done,
  onMove,
}: {
  match: Match;
  busy: boolean;
  done: boolean;
  onMove: (body: unknown) => void;
}) {
  const heaps = (match.state as { heaps: number[] }).heaps;
  const [take, setTake] = useState(1);
  return (
    <div className="stack" style={{ maxWidth: "none" }}>
      <p className="hint">choose a heap, then how many to take</p>
      <label className="inject-label">
        take
        <input
          type="number"
          min={1}
          max={Math.max(1, ...heaps)}
          value={take}
          onChange={(e) => setTake(Number(e.target.value))}
        />
      </label>
      <div className="row">
        {heaps.map((h, i) => (
          <button
            key={i}
            className="btn mint"
            disabled={busy || done || h < 1 || take < 1 || take > h}
            onClick={() => onMove({ heap: i, take })}
          >
            heap {i + 1}: {h}
          </button>
        ))}
      </div>
    </div>
  );
}

function NumberBoard({
  match,
  busy,
  done,
  onMove,
}: {
  match: Match;
  busy: boolean;
  done: boolean;
  onMove: (body: unknown) => void;
}) {
  const n = (match.state as { n: number }).n;
  const options = [1, 4, 9, 16, 25].filter((x) => x <= n);
  return (
    <div className="stack" style={{ maxWidth: "none" }}>
      <div className="status">remaining: {n}</div>
      <div className="row">
        {options.map((t) => (
          <button
            key={t}
            className="btn mint"
            disabled={busy || done}
            onClick={() => onMove({ take: t })}
          >
            −{t}
          </button>
        ))}
      </div>
    </div>
  );
}

function ReversiBoard({
  match,
  busy,
  done,
  onMove,
}: {
  match: Match;
  busy: boolean;
  done: boolean;
  onMove: (body: unknown) => void;
}) {
  const state = match.state as { cols: number; cells: number[] };
  const fresh = useFresh(state.cells.map(String));
  const canMove = reversiHasMove(state.cells, state.cols);
  return (
    <div className="stack" style={{ maxWidth: "none" }}>
      {!done && !canMove ? (
        <button className="btn mint" disabled={busy} onClick={() => onMove({ pass: true })}>
          pass
        </button>
      ) : null}
      <div
        className="board"
        style={fit(state.cols, Math.ceil(state.cells.length / state.cols))}
      >
        {state.cells.map((c, i) => (
          <button
            key={i}
            className={`cell ${c === 1 ? "p1" : c === 2 ? "p2" : "empty"} ${fresh.has(i) ? "fresh flip" : ""}`}
            disabled={busy || done || c !== 0}
            onClick={() => onMove({ index: i })}
          />
        ))}
      </div>
    </div>
  );
}

function reversiHasMove(cells: number[], cols: number) {
  const dirs = [
    [-1, -1],
    [-1, 0],
    [-1, 1],
    [0, -1],
    [0, 1],
    [1, -1],
    [1, 0],
    [1, 1],
  ] as const;
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] !== 0) continue;
    const r0 = Math.floor(i / cols);
    const c0 = i % cols;
    for (const [dr, dc] of dirs) {
      let r = r0 + dr;
      let c = c0 + dc;
      let seen = false;
      while (r >= 0 && r < cols && c >= 0 && c < cols) {
        const v = cells[r * cols + c];
        if (v === 2) seen = true;
        else if (v === 1 && seen) return true;
        else break;
        r += dr;
        c += dc;
      }
    }
  }
  return false;
}

function HexapawnBoard({
  match,
  busy,
  done,
  onMove,
}: {
  match: Match;
  busy: boolean;
  done: boolean;
  onMove: (body: unknown) => void;
}) {
  const cells = (match.state as { cells: number[] }).cells;
  const [from, setFrom] = useState<number | null>(null);
  return (
    <div className="stack" style={{ maxWidth: "none" }}>
      <p className="hint">
        {from === null ? "select your pawn (bottom)" : "select destination"}
      </p>
      <div className="board" style={fit(3, 3)}>
        {cells.map((c, i) => (
          <button
            key={i}
            className={`cell ${c === 1 ? "p1" : c === 2 ? "p2" : "empty"} ${from === i ? "x" : ""}`}
            disabled={busy || done}
            onClick={() => {
              if (from === null) {
                if (c === 1) setFrom(i);
                return;
              }
              onMove({ from, to: i });
              setFrom(null);
            }}
          >
            {c === 1 ? "▲" : c === 2 ? "▼" : ""}
          </button>
        ))}
      </div>
    </div>
  );
}

function MancalaBoard({
  match,
  busy,
  done,
  onMove,
}: {
  match: Match;
  busy: boolean;
  done: boolean;
  onMove: (body: unknown) => void;
}) {
  const pits = (match.state as { pits: number[] }).pits;
  return (
    <div className="stack" style={{ maxWidth: "none" }}>
      <p className="hint">
        bot store {pits[13]} · your store {pits[6]} — tap a pit in your row
      </p>
      <div className="row">
        {pits.slice(7, 13).reverse().map((n, idx) => (
          <span key={idx} className="badge">
            {n}
          </span>
        ))}
      </div>
      <div className="row">
        {pits.slice(0, 6).map((n, pit) => (
          <button
            key={pit}
            className="btn mint"
            disabled={busy || done || n === 0}
            onClick={() => onMove({ pit })}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

function MemoryBoard({
  match,
  busy,
  done,
  onMove,
}: {
  match: Match;
  busy: boolean;
  done: boolean;
  onMove: (body: unknown) => void;
}) {
  const state = match.state as {
    cols: number;
    cards: number[];
    matched: boolean[];
    scores: { human: number; bot: number };
  };
  const [pick, setPick] = useState<number | null>(null);
  const glyphs = ["◆", "●", "▲", "■", "★", "✚", "♥", "☀"];

  return (
    <div className="stack" style={{ maxWidth: "none" }}>
      <p className="hint">
        pairs · you {state.scores.human} · bot {state.scores.bot}
        {pick === null ? " — pick first card" : " — pick second card"}
      </p>
      <div
        className="board"
        style={fit(state.cols, Math.ceil(state.cards.length / state.cols))}
      >
        {state.cards.map((card, i) => {
          const show = state.matched[i] || pick === i;
          return (
            <button
              key={i}
              className={`cell ${state.matched[i] ? "p1" : ""}`}
              disabled={busy || done || state.matched[i] || pick === i}
              onClick={() => {
                if (pick === null) {
                  setPick(i);
                  return;
                }
                onMove({ a: pick, b: i });
                setPick(null);
              }}
            >
              {show ? glyphs[card] : "?"}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function BoxesBoard({
  match,
  busy,
  done,
  onMove,
}: {
  match: Match;
  busy: boolean;
  done: boolean;
  onMove: (body: unknown) => void;
}) {
  const state = match.state as {
    size: number;
    h: boolean[];
    v: boolean[];
    owner: number[];
    scores: { human: number; bot: number };
  };
  const size = state.size;
  return (
    <div className="stack" style={{ maxWidth: "none" }}>
      <p className="hint">
        boxes · you {state.scores.human} · bot {state.scores.bot}
      </p>
      <div className="boxes-board">
        {Array.from({ length: size + 1 }, (_, r) => (
          <div key={`hrow-${r}`}>
            <div className="boxes-hrow">
              {Array.from({ length: size }, (_, c) => {
                const index = r * size + c;
                return (
                  <button
                    key={index}
                    className={`boxes-edge h ${state.h[index] ? "taken" : ""}`}
                    disabled={busy || done || state.h[index]}
                    onClick={() => onMove({ dir: "h", index })}
                  />
                );
              })}
            </div>
            {r < size ? (
              <div className="boxes-vrow">
                {Array.from({ length: size + 1 }, (_, c) => {
                  const index = r * (size + 1) + c;
                  return (
                    <div key={index} className="boxes-vcell">
                      <button
                        className={`boxes-edge v ${state.v[index] ? "taken" : ""}`}
                        disabled={busy || done || state.v[index]}
                        onClick={() => onMove({ dir: "v", index })}
                      />
                      {c < size ? (
                        <span
                          className={`boxes-owner ${
                            state.owner[r * size + c] === 1
                              ? "p1"
                              : state.owner[r * size + c] === 2
                                ? "p2"
                                : ""
                          }`}
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

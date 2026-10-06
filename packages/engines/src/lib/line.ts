import type { EngineStatus, GameEngine, MoveResult } from "@arcade/game-core";

export type Cell = "X" | "O" | "";

export type CellState = { kind: "cells"; cols: number; cells: Cell[] };
export type IndexMove = { index: number };

const DIRS = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
] as const;

export function lineWinner(
  board: Cell[],
  lines: readonly (readonly number[])[],
): "X" | "O" | null {
  for (const line of lines) {
    const mark = board[line[0]!];
    if (mark && line.every((i) => board[i] === mark)) return mark;
  }
  return null;
}

export function tttLines(): number[][] {
  return [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];
}

/** N-in-a-row on a rectangle. Returns the winner, draw, or null if still open. */
export function nInRow(
  board: Cell[],
  rows: number,
  cols: number,
  n: number,
): "X" | "O" | "draw" | null {
  const at = (r: number, c: number) => board[r * cols + c];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const mark = at(r, c);
      if (!mark) continue;
      for (const [dr, dc] of DIRS) {
        let ok = true;
        for (let k = 1; k < n; k++) {
          const rr = r + dr * k;
          const cc = c + dc * k;
          if (rr < 0 || rr >= rows || cc < 0 || cc >= cols || at(rr, cc) !== mark) {
            ok = false;
            break;
          }
        }
        if (ok) return mark;
      }
    }
  }
  if (board.every((c) => c !== "")) return "draw";
  return null;
}

export function statusFrom(w: "X" | "O" | "draw" | null): EngineStatus {
  if (w === "X") return "human_win";
  if (w === "O") return "bot_win";
  if (w === "draw") return "draw";
  return "playing";
}

function minimax(
  board: Cell[],
  depth: number,
  botTurn: boolean,
  score: (b: Cell[]) => number,
): number {
  const terminal = score(board);
  if (depth <= 0 || Math.abs(terminal) >= 800) return terminal;
  const mark: Cell = botTurn ? "O" : "X";
  let best = botTurn ? -Infinity : Infinity;
  let moved = false;
  for (let i = 0; i < board.length; i++) {
    if (board[i] !== "") continue;
    moved = true;
    board[i] = mark;
    const next = minimax(board, depth - 1, !botTurn, score);
    board[i] = "";
    best = botTurn ? Math.max(best, next) : Math.min(best, next);
  }
  return moved ? best : terminal;
}

/** Place-X-then-bot-O engine with a depth-limited search. */
export function placeEngine(opts: {
  id: string;
  name: string;
  description: string;
  rules: string;
  size: number;
  cols: number;
  depth: number;
  winner: (board: Cell[]) => "X" | "O" | "draw" | null;
  /** Soft score when nobody has won yet. Positive favors the bot. */
  heuristic?: (board: Cell[]) => number;
}): GameEngine<CellState, IndexMove> {
  const score = (board: Cell[]) => {
    const w = opts.winner(board);
    if (w === "O") return 1000;
    if (w === "X") return -1000;
    if (w === "draw") return 0;
    return opts.heuristic?.(board) ?? 0;
  };

  return {
    id: opts.id,
    name: opts.name,
    description: opts.description,
    rules: opts.rules,
    newState: () => ({
      kind: "cells",
      cols: opts.cols,
      cells: Array(opts.size).fill("") as Cell[],
    }),
    applyHumanMove(state, move): MoveResult<CellState> {
      const { index } = move;
      if (
        !Number.isInteger(index) ||
        index < 0 ||
        index >= opts.size ||
        state.cells[index] !== "" ||
        opts.winner(state.cells)
      ) {
        return { state, illegal: true };
      }
      const cells = [...state.cells] as Cell[];
      cells[index] = "X";
      return { state: { ...state, cells } };
    },
    applyBotMove(state) {
      if (opts.winner(state.cells)) return state;
      let best = -1;
      let bestScore = -Infinity;
      const board = [...state.cells] as Cell[];
      for (let i = 0; i < board.length; i++) {
        if (board[i] !== "") continue;
        board[i] = "O";
        const value = minimax(board, opts.depth - 1, false, score);
        board[i] = "";
        if (value > bestScore) {
          bestScore = value;
          best = i;
        }
      }
      if (best < 0) return state;
      const cells = [...state.cells] as Cell[];
      cells[best] = "O";
      return { ...state, cells };
    },
    status(state) {
      return statusFrom(opts.winner(state.cells));
    },
  };
}

/** Immediate win, else block, else nearest-center empty cell. Safe on large boards. */
export function threatMove(board: Cell[], rows: number, cols: number, n: number): number {
  const winner = (b: Cell[]) => nInRow(b, rows, cols, n);
  const empties: number[] = [];
  for (let i = 0; i < board.length; i++) if (board[i] === "") empties.push(i);

  for (const mark of ["O", "X"] as const) {
    for (const i of empties) {
      const trial = [...board] as Cell[];
      trial[i] = mark;
      if (winner(trial) === mark) return i;
    }
  }

  const midR = (rows - 1) / 2;
  const midC = (cols - 1) / 2;
  empties.sort((a, b) => {
    const da = Math.abs(Math.floor(a / cols) - midR) + Math.abs((a % cols) - midC);
    const db = Math.abs(Math.floor(b / cols) - midR) + Math.abs((b % cols) - midC);
    return da - db;
  });
  return empties[0] ?? -1;
}

import type { EngineStatus, GameEngine, MoveResult } from "@arcade/game-core";

export type Cell = "X" | "O" | "";

export function lineWinner(board: Cell[], lines: readonly (readonly number[])[]): "X" | "O" | null {
  for (const line of lines) {
    const a = board[line[0]!];
    if (a && line.every((i) => board[i] === a)) return a as "X" | "O";
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

/** Perfect-ish bot for small placement games (human=X, bot=O). */
export function bestPlaceMove(
  board: Cell[],
  evaluate: (b: Cell[], botTurn: boolean) => number,
  depth: number,
): number {
  let best = -1;
  let bestScore = -Infinity;
  for (let i = 0; i < board.length; i++) {
    if (board[i] !== "") continue;
    const next = [...board] as Cell[];
    next[i] = "O";
    const score = minimaxPlace(next, depth - 1, false, evaluate);
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

function minimaxPlace(
  board: Cell[],
  depth: number,
  botTurn: boolean,
  evaluate: (b: Cell[], botTurn: boolean) => number,
): number {
  const terminal = evaluate(board, botTurn);
  if (depth <= 0 || Math.abs(terminal) >= 500) return terminal;

  if (botTurn) {
    let best = -Infinity;
    let moves = 0;
    for (let i = 0; i < board.length; i++) {
      if (board[i] !== "") continue;
      moves++;
      board[i] = "O";
      best = Math.max(best, minimaxPlace(board, depth - 1, false, evaluate));
      board[i] = "";
    }
    return moves ? best : terminal;
  }

  let best = Infinity;
  let moves = 0;
  for (let i = 0; i < board.length; i++) {
    if (board[i] !== "") continue;
    moves++;
    board[i] = "X";
    best = Math.min(best, minimaxPlace(board, depth - 1, true, evaluate));
    board[i] = "";
  }
  return moves ? best : terminal;
}

export function randomEmpty(board: Cell[]): number {
  const empties = board.map((c, i) => (c === "" ? i : -1)).filter((i) => i >= 0);
  return empties[Math.floor(Math.random() * empties.length)] ?? -1;
}

export function statusFromMark(w: "X" | "O" | "draw" | null): EngineStatus {
  if (w === "X") return "human_win";
  if (w === "O") return "bot_win";
  if (w === "draw") return "draw";
  return "playing";
}

export function placeEngine(opts: {
  id: string;
  name: string;
  description: string;
  size: number;
  cols: number;
  depth: number;
  winner: (board: Cell[]) => "X" | "O" | "draw" | null;
  score?: (board: Cell[]) => number;
}): GameEngine<{ kind: "cells"; cols: number; cells: Cell[] }, { index: number }> {
  const evaluate = (board: Cell[]) => {
    const w = opts.winner(board);
    if (w === "O") return 1000;
    if (w === "X") return -1000;
    if (w === "draw") return 0;
    return opts.score?.(board) ?? 0;
  };

  return {
    id: opts.id,
    name: opts.name,
    description: opts.description,
    newState: () => ({
      kind: "cells",
      cols: opts.cols,
      cells: Array(opts.size).fill("") as Cell[],
    }),
    applyHumanMove(state, move): MoveResult<typeof state> {
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
      const move = bestPlaceMove(state.cells, (b) => evaluate(b), opts.depth);
      if (move < 0) return state;
      const cells = [...state.cells] as Cell[];
      cells[move] = "O";
      return { ...state, cells };
    },
    status(state) {
      return statusFromMark(opts.winner(state.cells));
    },
  };
}

export function nInRowWinner(
  board: Cell[],
  rows: number,
  cols: number,
  n: number,
): "X" | "O" | "draw" | null {
  const dirs = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ] as const;
  const at = (r: number, c: number) => board[r * cols + c]!;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const start = at(r, c);
      if (!start) continue;
      for (const [dr, dc] of dirs) {
        let ok = true;
        for (let k = 1; k < n; k++) {
          const rr = r + dr * k;
          const cc = c + dc * k;
          if (rr < 0 || rr >= rows || cc < 0 || cc >= cols || at(rr, cc) !== start) {
            ok = false;
            break;
          }
        }
        if (ok) return start as "X" | "O";
      }
    }
  }
  if (board.every((c) => c !== "")) return "draw";
  return null;
}

import type { BotDifficulty, EngineStatus, GameEngine, MoveResult } from "@arcade/game-core";
import { depthFor } from "../lib/difficulty";

const ROWS = 6;
const COLS = 7;
export type C4Cell = 0 | 1 | 2; // empty | human | bot
export type C4State = { grid: C4Cell[] }; // row-major 6x7
export type C4Move = { column: number };

function idx(r: number, c: number) {
  return r * COLS + c;
}

function emptyGrid(): C4Cell[] {
  return Array(ROWS * COLS).fill(0) as C4Cell[];
}

function drop(grid: C4Cell[], column: number, player: 1 | 2): C4Cell[] | null {
  if (column < 0 || column >= COLS) return null;
  for (let r = ROWS - 1; r >= 0; r--) {
    const i = idx(r, column);
    if (grid[i] === 0) {
      const next = [...grid] as C4Cell[];
      next[i] = player;
      return next;
    }
  }
  return null;
}

function checkWin(grid: C4Cell[], player: 1 | 2): boolean {
  const dirs = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ] as const;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[idx(r, c)] !== player) continue;
      for (const [dr, dc] of dirs) {
        let ok = true;
        for (let k = 1; k < 4; k++) {
          const rr = r + dr * k;
          const cc = c + dc * k;
          if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS || grid[idx(rr, cc)] !== player) {
            ok = false;
            break;
          }
        }
        if (ok) return true;
      }
    }
  }
  return false;
}

function isFull(grid: C4Cell[]) {
  return grid.every((c) => c !== 0);
}

function validColumns(grid: C4Cell[]) {
  const cols: number[] = [];
  for (let c = 0; c < COLS; c++) if (grid[idx(0, c)] === 0) cols.push(c);
  return cols;
}

/** Depth-limited minimax with center bias — strong but fast. */
function scoreWindow(window: C4Cell[], player: 1 | 2): number {
  const opp = player === 1 ? 2 : 1;
  const count = (p: C4Cell) => window.filter((x) => x === p).length;
  const p = count(player);
  const o = count(opp);
  const e = count(0);
  if (p === 4) return 100;
  if (p === 3 && e === 1) return 10;
  if (p === 2 && e === 2) return 4;
  if (o === 3 && e === 1) return -12;
  return 0;
}

function evaluate(grid: C4Cell[], player: 1 | 2): number {
  let score = 0;
  const center = Math.floor(COLS / 2);
  for (let r = 0; r < ROWS; r++) if (grid[idx(r, center)] === player) score += 3;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS - 3; c++) {
      score += scoreWindow(
        [grid[idx(r, c)], grid[idx(r, c + 1)], grid[idx(r, c + 2)], grid[idx(r, c + 3)]],
        player,
      );
    }
  }
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS - 3; r++) {
      score += scoreWindow(
        [grid[idx(r, c)], grid[idx(r + 1, c)], grid[idx(r + 2, c)], grid[idx(r + 3, c)]],
        player,
      );
    }
  }
  for (let r = 0; r < ROWS - 3; r++) {
    for (let c = 0; c < COLS - 3; c++) {
      score += scoreWindow(
        [
          grid[idx(r, c)],
          grid[idx(r + 1, c + 1)],
          grid[idx(r + 2, c + 2)],
          grid[idx(r + 3, c + 3)],
        ],
        player,
      );
      score += scoreWindow(
        [
          grid[idx(r + 3, c)],
          grid[idx(r + 2, c + 1)],
          grid[idx(r + 1, c + 2)],
          grid[idx(r, c + 3)],
        ],
        player,
      );
    }
  }
  return score;
}

function minimax(
  grid: C4Cell[],
  depth: number,
  alpha: number,
  beta: number,
  maximizing: boolean,
): { score: number; column: number } {
  const bot = 2 as const;
  const human = 1 as const;
  if (checkWin(grid, bot)) return { score: 1_000_000 + depth, column: -1 };
  if (checkWin(grid, human)) return { score: -1_000_000 - depth, column: -1 };
  const cols = validColumns(grid);
  if (depth === 0 || cols.length === 0) {
    return { score: evaluate(grid, bot), column: cols[3] ?? cols[0] ?? -1 };
  }

  let bestCol = cols[Math.floor(cols.length / 2)];
  if (maximizing) {
    let value = -Infinity;
    for (const c of cols) {
      const next = drop(grid, c, bot)!;
      const { score } = minimax(next, depth - 1, alpha, beta, false);
      if (score > value) {
        value = score;
        bestCol = c;
      }
      alpha = Math.max(alpha, value);
      if (alpha >= beta) break;
    }
    return { score: value, column: bestCol };
  }

  let value = Infinity;
  for (const c of cols) {
    const next = drop(grid, c, human)!;
    const { score } = minimax(next, depth - 1, alpha, beta, true);
    if (score < value) {
      value = score;
      bestCol = c;
    }
    beta = Math.min(beta, value);
    if (alpha >= beta) break;
  }
  return { score: value, column: bestCol };
}

export const connectFourEngine: GameEngine<C4State, C4Move> = {
  id: "connectfour",
  name: "Connect Four",
  description: "Drop discs on a 6×7 board. Four in a row wins.",
  rules: "Tap a column to drop your disc. It falls to the lowest open cell. Connect four horizontally, vertically, or diagonally before the bot does.",
  newState: () => ({ grid: emptyGrid() }),
  applyHumanMove(state, move): MoveResult<C4State> {
    if (checkWin(state.grid, 1) || checkWin(state.grid, 2) || isFull(state.grid)) {
      return { state, illegal: true };
    }
    const next = drop(state.grid, move.column, 1);
    if (!next) return { state, illegal: true };
    return { state: { grid: next } };
  },
  applyBotMove(state, difficulty?: BotDifficulty) {
    if (checkWin(state.grid, 1) || checkWin(state.grid, 2) || isFull(state.grid)) return state;
    const { column } = minimax(state.grid, depthFor(4, difficulty, 7), -Infinity, Infinity, true);
    const next = drop(state.grid, column, 2);
    return next ? { grid: next } : state;
  },
  status(state): EngineStatus {
    if (checkWin(state.grid, 1)) return "human_win";
    if (checkWin(state.grid, 2)) return "bot_win";
    if (isFull(state.grid)) return "draw";
    return "playing";
  },
};

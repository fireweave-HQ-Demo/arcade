import type { EngineStatus, GameEngine, MoveResult } from "@arcade/game-core";

export type DropState = { kind: "drop"; rows: number; cols: number; grid: number[] };
export type DropMove = { column: number };

/**
 * Gravity board. Human is 1, bot is 2.
 * Bot searches a few moves ahead, taking wins and blocking yours.
 */
export function dropEngine(opts: {
  id: string;
  name: string;
  description: string;
  rules: string;
  rows: number;
  cols: number;
  need: number;
}): GameEngine<DropState, DropMove> {
  const { rows, cols, need } = opts;
  const idx = (r: number, c: number) => r * cols + c;

  function drop(grid: number[], column: number, player: 1 | 2): number[] | null {
    if (!Number.isInteger(column) || column < 0 || column >= cols) return null;
    for (let r = rows - 1; r >= 0; r--) {
      if (grid[idx(r, column)] === 0) {
        const next = [...grid];
        next[idx(r, column)] = player;
        return next;
      }
    }
    return null;
  }

  function won(grid: number[], player: 1 | 2): boolean {
    const dirs = [
      [0, 1],
      [1, 0],
      [1, 1],
      [1, -1],
    ] as const;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[idx(r, c)] !== player) continue;
        for (const [dr, dc] of dirs) {
          let ok = true;
          for (let k = 1; k < need; k++) {
            const rr = r + dr * k;
            const cc = c + dc * k;
            if (rr < 0 || rr >= rows || cc < 0 || cc >= cols || grid[idx(rr, cc)] !== player) {
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

  function openCols(grid: number[]) {
    return Array.from({ length: cols }, (_, c) => c).filter((c) => grid[idx(0, c)] === 0);
  }

  function choose(grid: number[]): number {
    const open = openCols(grid);
    let best = open[0] ?? 0;
    let bestScore = -Infinity;
    for (const column of open) {
      const next = drop(grid, column, 2);
      if (!next) continue;
      const score = search(next, false, 3, -Infinity, Infinity);
      if (score > bestScore) {
        bestScore = score;
        best = column;
      }
    }
    return best;
  }

  function search(grid: number[], botTurn: boolean, depth: number, alpha: number, beta: number): number {
    if (won(grid, 2)) return 1000 + depth;
    if (won(grid, 1)) return -1000 - depth;
    const open = openCols(grid);
    if (!open.length || depth <= 0) return evaluate(grid);
    if (botTurn) {
      let value = -Infinity;
      for (const column of open) {
        const next = drop(grid, column, 2);
        if (!next) continue;
        value = Math.max(value, search(next, false, depth - 1, alpha, beta));
        alpha = Math.max(alpha, value);
        if (alpha >= beta) break;
      }
      return value;
    }
    let value = Infinity;
    for (const column of open) {
      const next = drop(grid, column, 1);
      if (!next) continue;
      value = Math.min(value, search(next, true, depth - 1, alpha, beta));
      beta = Math.min(beta, value);
      if (alpha >= beta) break;
    }
    return value;
  }

  function evaluate(grid: number[]) {
    let score = 0;
    const center = (cols - 1) / 2;
    for (const column of openCols(grid)) score -= Math.abs(column - center);
    const dirs = [
      [0, 1],
      [1, 0],
      [1, 1],
      [1, -1],
    ] as const;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        for (const [dr, dc] of dirs) {
          let bot = 0;
          let human = 0;
          let empty = 0;
          let ok = true;
          for (let k = 0; k < need; k++) {
            const rr = r + dr * k;
            const cc = c + dc * k;
            if (rr < 0 || rr >= rows || cc < 0 || cc >= cols) {
              ok = false;
              break;
            }
            const cell = grid[idx(rr, cc)];
            if (cell === 2) bot++;
            else if (cell === 1) human++;
            else empty++;
          }
          if (!ok || (bot > 0 && human > 0)) continue;
          if (bot === need - 1 && empty === 1) score += 40;
          else if (bot > 0 && empty === need - bot) score += bot * 3;
          if (human === need - 1 && empty === 1) score -= 50;
          else if (human > 0 && empty === need - human) score -= human * 3;
        }
      }
    }
    return score;
  }

  function over(grid: number[]) {
    return won(grid, 1) || won(grid, 2) || grid.every((x) => x !== 0);
  }

  return {
    id: opts.id,
    name: opts.name,
    description: opts.description,
    rules: opts.rules,
    newState: () => ({
      kind: "drop",
      rows,
      cols,
      grid: Array(rows * cols).fill(0),
    }),
    applyHumanMove(state, move): MoveResult<DropState> {
      if (over(state.grid)) return { state, illegal: true };
      const next = drop(state.grid, move.column, 1);
      if (!next) return { state, illegal: true };
      return { state: { ...state, grid: next } };
    },
    applyBotMove(state) {
      if (over(state.grid)) return state;
      const next = drop(state.grid, choose(state.grid), 2);
      return next ? { ...state, grid: next } : state;
    },
    status(state): EngineStatus {
      if (won(state.grid, 1)) return "human_win";
      if (won(state.grid, 2)) return "bot_win";
      if (state.grid.every((x) => x !== 0)) return "draw";
      return "playing";
    },
  };
}

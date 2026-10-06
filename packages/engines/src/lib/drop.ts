import type { EngineStatus, GameEngine, MoveResult } from "@arcade/game-core";

export type DropState = { kind: "drop"; rows: number; cols: number; grid: number[] };
export type DropMove = { column: number };

/**
 * Gravity board. Human is 1, bot is 2.
 * Bot takes a win, blocks a win, otherwise prefers the center.
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
    for (const player of [2, 1] as const) {
      for (const c of open) {
        const next = drop(grid, c, player);
        if (next && won(next, player)) return c;
      }
    }
    const center = (cols - 1) / 2;
    return [...open].sort((a, b) => Math.abs(a - center) - Math.abs(b - center))[0] ?? 0;
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

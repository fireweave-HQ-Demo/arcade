import type { EngineStatus, GameEngine, MoveResult } from "@arcade/game-core";

const N = 6;
type State = { kind: "reversi"; cols: number; cells: number[] };
type Move = { index?: number; pass?: boolean };

const DIRS = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
] as const;

function flips(cells: number[], index: number, player: 1 | 2): number[] {
  if (cells[index] !== 0) return [];
  const opp = player === 1 ? 2 : 1;
  const r0 = Math.floor(index / N);
  const c0 = index % N;
  const out: number[] = [];
  for (const [dr, dc] of DIRS) {
    const path: number[] = [];
    let r = r0 + dr;
    let c = c0 + dc;
    while (r >= 0 && r < N && c >= 0 && c < N) {
      const i = r * N + c;
      if (cells[i] === opp) path.push(i);
      else if (cells[i] === player && path.length) {
        out.push(...path);
        break;
      } else break;
      r += dr;
      c += dc;
    }
  }
  return out;
}

function moves(cells: number[], player: 1 | 2) {
  const list: number[] = [];
  for (let i = 0; i < N * N; i++) if (flips(cells, i, player).length) list.push(i);
  return list;
}

function apply(cells: number[], index: number, player: 1 | 2) {
  const flipped = flips(cells, index, player);
  if (!flipped.length) return null;
  const next = [...cells];
  next[index] = player;
  for (const f of flipped) next[f] = player;
  return next;
}

function start(): number[] {
  const cells = Array(N * N).fill(0);
  const m = N / 2;
  cells[(m - 1) * N + (m - 1)] = 2;
  cells[(m - 1) * N + m] = 1;
  cells[m * N + (m - 1)] = 1;
  cells[m * N + m] = 2;
  return cells;
}

const CORNERS = [0, N - 1, N * (N - 1), N * N - 1];

function evaluate(cells: number[]) {
  let score = 0;
  for (let i = 0; i < cells.length; i++) {
    const weight = CORNERS.includes(i) ? 8 : 1;
    if (cells[i] === 2) score += weight;
    else if (cells[i] === 1) score -= weight;
  }
  score += (moves(cells, 2).length - moves(cells, 1).length) * 2;
  return score;
}

function search(cells: number[], player: 1 | 2, depth: number, alpha: number, beta: number): number {
  const legal = moves(cells, player);
  const other = (player === 1 ? 2 : 1) as 1 | 2;
  if (!legal.length) {
    if (!moves(cells, other).length) {
      const human = cells.filter((c) => c === 1).length;
      const bot = cells.filter((c) => c === 2).length;
      if (bot > human) return 1000;
      if (human > bot) return -1000;
      return 0;
    }
    return -search(cells, other, depth, -beta, -alpha);
  }
  if (depth <= 0) return player === 2 ? evaluate(cells) : -evaluate(cells);
  let value = -Infinity;
  for (const index of legal) {
    const next = apply(cells, index, player);
    if (!next) continue;
    const score = -search(next, other, depth - 1, -beta, -alpha);
    value = Math.max(value, score);
    alpha = Math.max(alpha, value);
    if (alpha >= beta) break;
  }
  return value;
}

function outcome(cells: number[]): EngineStatus {
  const human = cells.filter((c) => c === 1).length;
  const bot = cells.filter((c) => c === 2).length;
  if (human > bot) return "human_win";
  if (bot > human) return "bot_win";
  return "draw";
}

export const reversiEngine: GameEngine<State, Move> = {
  id: "reversi",
  name: "Reversi",
  description: "6×6. Flank discs and flip them.",
  rules: "Place a disc so it brackets one or more of the bot's discs in a straight line. Those discs flip to you. If you have no legal placement, tap Pass. Most discs when neither side can move wins.",
  newState: () => ({ kind: "reversi", cols: N, cells: start() }),
  applyHumanMove(state, move): MoveResult<State> {
    const legal = moves(state.cells, 1);
    if (move.pass) {
      if (legal.length) return { state, illegal: true };
      return { state };
    }
    if (!Number.isInteger(move.index)) return { state, illegal: true };
    const next = apply(state.cells, move.index!, 1);
    if (!next) return { state, illegal: true };
    return { state: { ...state, cells: next } };
  },
  applyBotMove(state) {
    const legal = moves(state.cells, 2);
    if (!legal.length) return state;
    let best = legal[0]!;
    let bestScore = -Infinity;
    for (const index of legal) {
      const next = apply(state.cells, index, 2);
      if (!next) continue;
      const score = -search(next, 1, 3, -Infinity, Infinity);
      if (score > bestScore) {
        bestScore = score;
        best = index;
      }
    }
    const next = apply(state.cells, best, 2);
    return next ? { ...state, cells: next } : state;
  },
  status(state): EngineStatus {
    if (moves(state.cells, 1).length || moves(state.cells, 2).length) return "playing";
    return outcome(state.cells);
  },
};

export function reversiHumanMoves(cells: number[]) {
  return moves(cells, 1);
}

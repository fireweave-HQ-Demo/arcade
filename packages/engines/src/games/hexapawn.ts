import type { BotDifficulty, EngineStatus, GameEngine, MoveResult } from "@arcade/game-core";

type State = { kind: "hexapawn"; cols: number; cells: number[] };
type Move = { from: number; to: number };

function apply(cells: number[], move: Move, player: 1 | 2) {
  const next = [...cells];
  next[move.to] = player;
  next[move.from] = 0;
  return next;
}

/** Bot (2) maximises. A line of three on 3×3 is short enough to solve. */
function search(cells: number[], turn: 1 | 2, alpha: number, beta: number): number {
  if (cells.slice(0, 3).includes(1)) return -1000;
  if (cells.slice(6).includes(2)) return 1000;
  const options = legal(cells, turn);
  if (!options.length) return turn === 2 ? -1000 : 1000;
  if (turn === 2) {
    let value = -Infinity;
    for (const move of options) {
      value = Math.max(value, search(apply(cells, move, 2), 1, alpha, beta));
      alpha = Math.max(alpha, value);
      if (alpha >= beta) break;
    }
    return value;
  }
  let value = Infinity;
  for (const move of options) {
    value = Math.min(value, search(apply(cells, move, 1), 2, alpha, beta));
    beta = Math.min(beta, value);
    if (alpha >= beta) break;
  }
  return value;
}

function legal(cells: number[], player: 1 | 2): Move[] {
  const dir = player === 1 ? -1 : 1;
  const out: Move[] = [];
  for (let i = 0; i < 9; i++) {
    if (cells[i] !== player) continue;
    const r = Math.floor(i / 3);
    const c = i % 3;
    const nr = r + dir;
    if (nr < 0 || nr > 2) continue;
    const ahead = nr * 3 + c;
    if (cells[ahead] === 0) out.push({ from: i, to: ahead });
    for (const dc of [-1, 1]) {
      const nc = c + dc;
      if (nc < 0 || nc > 2) continue;
      const diag = nr * 3 + nc;
      const occ = cells[diag] ?? 0;
      if (occ !== 0 && occ !== player) out.push({ from: i, to: diag });
    }
  }
  return out;
}

export const hexapawnEngine: GameEngine<State, Move> = {
  id: "hexapawn",
  name: "Hexapawn",
  description: "3×3 pawn race. Reach the far rank or trap the bot.",
  rules: "Your pawns start on the bottom row (▲) and move one step forward onto an empty square, or diagonally forward to capture. You win by reaching the top row or leaving the bot with no move. The bot plays the solved 3×3 game.",
  newState: () => ({ kind: "hexapawn", cols: 3, cells: [2, 2, 2, 0, 0, 0, 1, 1, 1] }),
  applyHumanMove(state, move): MoveResult<State> {
    const ok = legal(state.cells, 1).some((m) => m.from === move.from && m.to === move.to);
    if (!ok) return { state, illegal: true };
    const cells = [...state.cells];
    cells[move.to] = 1;
    cells[move.from] = 0;
    return { state: { ...state, cells } };
  },
  applyBotMove(state, difficulty?: BotDifficulty) {
    const options = legal(state.cells, 2);
    if (!options.length) return state;
    if (difficulty === "easy") {
      return { ...state, cells: apply(state.cells, options[0]!, 2) };
    }
    let best = options[0]!;
    let bestScore = -Infinity;
    for (const move of options) {
      const cells = apply(state.cells, move, 2);
      let score = search(cells, 1, -Infinity, Infinity);
      if (difficulty === "hard" || difficulty === "nightmare") {
        if (Math.floor(move.to / 3) === 2) score += difficulty === "nightmare" ? 3 : 2;
        else if (state.cells[move.to] === 1) score += difficulty === "nightmare" ? 2 : 1;
      }
      if (score > bestScore) {
        bestScore = score;
        best = move;
      }
    }
    return { ...state, cells: apply(state.cells, best, 2) };
  },
  status(state): EngineStatus {
    if (state.cells.slice(0, 3).includes(1)) return "human_win";
    if (state.cells.slice(6).includes(2)) return "bot_win";
    if (!legal(state.cells, 1).length) return "bot_win";
    if (!legal(state.cells, 2).length) return "human_win";
    return "playing";
  },
};

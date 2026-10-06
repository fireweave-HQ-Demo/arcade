import type { EngineStatus, GameEngine, MoveResult } from "@arcade/game-core";

type State = { kind: "hexapawn"; cols: number; cells: number[] };
type Move = { from: number; to: number };

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
  rules: "Your pawns start on the bottom row (▲) and move one step forward onto an empty square, or diagonally forward to capture. You win by reaching the top row or leaving the bot with no move.",
  newState: () => ({ kind: "hexapawn", cols: 3, cells: [2, 2, 2, 0, 0, 0, 1, 1, 1] }),
  applyHumanMove(state, move): MoveResult<State> {
    const ok = legal(state.cells, 1).some((m) => m.from === move.from && m.to === move.to);
    if (!ok) return { state, illegal: true };
    const cells = [...state.cells];
    cells[move.to] = 1;
    cells[move.from] = 0;
    return { state: { ...state, cells } };
  },
  applyBotMove(state) {
    const options = legal(state.cells, 2);
    if (!options.length) return state;
    const promo = options.find((m) => Math.floor(m.to / 3) === 2);
    const cap = options.find((m) => state.cells[m.to] === 1);
    const pick = promo ?? cap ?? options[0]!;
    const cells = [...state.cells];
    cells[pick.to] = 2;
    cells[pick.from] = 0;
    return { ...state, cells };
  },
  status(state): EngineStatus {
    if (state.cells.slice(0, 3).includes(1)) return "human_win";
    if (state.cells.slice(6).includes(2)) return "bot_win";
    if (!legal(state.cells, 1).length) return "bot_win";
    if (!legal(state.cells, 2).length) return "human_win";
    return "playing";
  },
};

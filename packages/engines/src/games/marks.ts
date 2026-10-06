import type { EngineStatus, GameEngine, MoveResult } from "@arcade/game-core";
import { lineWinner, nInRow, statusFrom, tttLines, type Cell } from "../lib/line";

type MarkState = { kind: "wild" | "sos" | "orderchaos"; cols: number; cells: string[]; scores?: { human: number; bot: number } };
type MarkMove = { index: number; mark: string };

function empty(kind: MarkState["kind"], cols: number, n: number, scores = false): MarkState {
  return {
    kind,
    cols,
    cells: Array(n).fill(""),
    ...(scores ? { scores: { human: 0, bot: 0 } } : {}),
  };
}

export const wildTttEngine: GameEngine<MarkState, MarkMove> = {
  id: "wildttt",
  name: "Wild Tic-Tac-Toe",
  description: "Place either X or O. First line wins.",
  rules: "Choose X or O, then tap an empty square. Either mark can complete your line. The bot does the same and will take a win or block one.",
  newState: () => empty("wild", 3, 9),
  applyHumanMove(state, move): MoveResult<MarkState> {
    if (!legalMark(state, move, ["X", "O"]) || lineWinner(state.cells as Cell[], tttLines())) {
      return { state, illegal: true };
    }
    const cells = [...state.cells];
    cells[move.index] = move.mark;
    return { state: { ...state, cells } };
  },
  applyBotMove(state) {
    if (lineWinner(state.cells as Cell[], tttLines()) || state.cells.every((c) => c !== "")) return state;
    for (const mark of ["O", "X"]) {
      for (let i = 0; i < 9; i++) {
        if (state.cells[i] !== "") continue;
        const trial = [...state.cells];
        trial[i] = mark;
        if (lineWinner(trial as Cell[], tttLines()) === mark) {
          return { ...state, cells: trial };
        }
      }
    }
    const i = state.cells.findIndex((c) => c === "");
    if (i < 0) return state;
    const cells = [...state.cells];
    cells[i] = "O";
    return { ...state, cells };
  },
  status(state): EngineStatus {
    const w = lineWinner(state.cells as Cell[], tttLines());
    if (w) return statusFrom(w);
    if (state.cells.every((c) => c !== "")) return "draw";
    return "playing";
  },
};

function sosAt(cells: string[], cols: number, index: number): number {
  const rows = cells.length / cols;
  const ar = Math.floor(index / cols);
  const ac = index % cols;
  let n = 0;
  const get = (r: number, c: number) =>
    r >= 0 && r < rows && c >= 0 && c < cols ? cells[r * cols + c] : null;
  for (const [dr, dc] of [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ] as const) {
    for (const mid of [0, 1, 2]) {
      const word = [0, 1, 2].map((k) => get(ar + dr * (k - mid), ac + dc * (k - mid)));
      if (word[0] === "S" && word[1] === "O" && word[2] === "S") n++;
    }
  }
  return n;
}

export const sosEngine: GameEngine<MarkState, MarkMove> = {
  id: "sos",
  name: "SOS",
  description: "4×4. Spell SOS to score.",
  rules: "Place S or O. Every SOS line you complete (any direction) adds a point. When the board is full, the higher score wins.",
  newState: () => empty("sos", 4, 16, true),
  applyHumanMove(state, move): MoveResult<MarkState> {
    if (!legalMark(state, move, ["S", "O"])) return { state, illegal: true };
    const cells = [...state.cells];
    cells[move.index] = move.mark;
    const gained = sosAt(cells, 4, move.index);
    return {
      state: {
        ...state,
        cells,
        scores: { human: (state.scores?.human ?? 0) + gained, bot: state.scores?.bot ?? 0 },
      },
    };
  },
  applyBotMove(state) {
    if (state.cells.every((c) => c !== "")) return state;
    let bestI = state.cells.findIndex((c) => c === "");
    let bestM = "S";
    let best = -1;
    for (let i = 0; i < 16; i++) {
      if (state.cells[i] !== "") continue;
      for (const mark of ["S", "O"]) {
        const cells = [...state.cells];
        cells[i] = mark;
        const g = sosAt(cells, 4, i);
        if (g > best) {
          best = g;
          bestI = i;
          bestM = mark;
        }
      }
    }
    const cells = [...state.cells];
    cells[bestI] = bestM;
    return {
      ...state,
      cells,
      scores: { human: state.scores?.human ?? 0, bot: (state.scores?.bot ?? 0) + Math.max(0, best) },
    };
  },
  status(state): EngineStatus {
    if (state.cells.some((c) => c === "")) return "playing";
    const h = state.scores?.human ?? 0;
    const b = state.scores?.bot ?? 0;
    if (h > b) return "human_win";
    if (b > h) return "bot_win";
    return "draw";
  },
};

export const orderChaosEngine: GameEngine<MarkState, MarkMove> = {
  id: "orderchaos",
  name: "Order & Chaos",
  description: "You are Order. Build five in a row on 6×6.",
  rules: "Place X or O anywhere empty. You win if either mark forms five in a row. The bot is Chaos and wins only if the board fills with no line of five.",
  newState: () => empty("orderchaos", 6, 36),
  applyHumanMove(state, move): MoveResult<MarkState> {
    if (!legalMark(state, move, ["X", "O"])) return { state, illegal: true };
    const cells = [...state.cells];
    cells[move.index] = move.mark;
    return { state: { ...state, cells } };
  },
  applyBotMove(state) {
    const done = nInRow(state.cells as Cell[], 6, 6, 5);
    if (done === "X" || done === "O" || state.cells.every((c) => c !== "")) return state;
    for (const mark of ["X", "O"] as const) {
      for (let i = 0; i < 36; i++) {
        if (state.cells[i] !== "") continue;
        const trial = [...state.cells] as Cell[];
        trial[i] = mark;
        if (nInRow(trial, 6, 6, 5) === mark) {
          const cells = [...state.cells];
          cells[i] = mark === "X" ? "O" : "X";
          return { ...state, cells };
        }
      }
    }
    const i = state.cells.findIndex((c) => c === "");
    if (i < 0) return state;
    const cells = [...state.cells];
    cells[i] = "X";
    return { ...state, cells };
  },
  status(state): EngineStatus {
    const w = nInRow(state.cells as Cell[], 6, 6, 5);
    if (w === "X" || w === "O") return "human_win";
    if (state.cells.every((c) => c !== "")) return "bot_win";
    return "playing";
  },
};

function legalMark(state: MarkState, move: MarkMove, marks: string[]) {
  return (
    Number.isInteger(move.index) &&
    move.index >= 0 &&
    move.index < state.cells.length &&
    marks.includes(move.mark) &&
    state.cells[move.index] === ""
  );
}

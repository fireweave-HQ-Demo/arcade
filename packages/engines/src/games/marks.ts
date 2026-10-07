import type { EngineStatus, GameEngine, MoveResult } from "@arcade/game-core";
import { lineWinner, nInRow, statusFrom, tttLines, type Cell } from "../lib/line";

type MarkState = {
  kind: "wild" | "sos" | "orderchaos";
  cols: number;
  cells: string[];
  scores?: { human: number; bot: number };
  last?: "human" | "bot";
};
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
    return { state: { ...state, cells, last: "human" } };
  },
  applyBotMove(state) {
    if (lineWinner(state.cells as Cell[], tttLines()) || state.cells.every((c) => c !== "")) return state;
    let bestI = -1;
    let bestM = "O";
    let bestScore = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (state.cells[i] !== "") continue;
      for (const mark of ["X", "O"]) {
        const trial = [...state.cells];
        trial[i] = mark;
        const score = wildSearch(trial, false, -Infinity, Infinity);
        if (score > bestScore) {
          bestScore = score;
          bestI = i;
          bestM = mark;
        }
      }
    }
    if (bestI < 0) return state;
    const cells = [...state.cells];
    cells[bestI] = bestM;
    return { ...state, cells, last: "bot" };
  },
  status(state): EngineStatus {
    const w = lineWinner(state.cells as Cell[], tttLines());
    if (w) {
      if (state.last === "human") return "human_win";
      if (state.last === "bot") return "bot_win";
      return statusFrom(w);
    }
    if (state.cells.every((c) => c !== "")) return "draw";
    return "playing";
  },
};

function wildSearch(cells: string[], botTurn: boolean, alpha: number, beta: number): number {
  if (lineWinner(cells as Cell[], tttLines())) return botTurn ? -1000 : 1000;
  const empties: number[] = [];
  for (let i = 0; i < cells.length; i++) if (cells[i] === "") empties.push(i);
  if (!empties.length) return 0;
  if (botTurn) {
    let value = -Infinity;
    for (const i of empties) {
      for (const mark of ["X", "O"]) {
        cells[i] = mark;
        value = Math.max(value, wildSearch(cells, false, alpha, beta));
        cells[i] = "";
        alpha = Math.max(alpha, value);
        if (alpha >= beta) return value;
      }
    }
    return value;
  }
  let value = Infinity;
  for (const i of empties) {
    for (const mark of ["X", "O"]) {
      cells[i] = mark;
      value = Math.min(value, wildSearch(cells, true, alpha, beta));
      cells[i] = "";
      beta = Math.min(beta, value);
      if (alpha >= beta) return value;
    }
  }
  return value;
}

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
    const scores = { human: state.scores?.human ?? 0, bot: state.scores?.bot ?? 0 };
    let bestI = state.cells.findIndex((c) => c === "");
    let bestM = "S";
    let best = -Infinity;
    const cells = [...state.cells];
    for (let i = 0; i < 16; i++) {
      if (cells[i] !== "") continue;
      for (const mark of ["S", "O"]) {
        cells[i] = mark;
        const gained = sosAt(cells, 4, i);
        const score = sosSearch(
          cells,
          { human: scores.human, bot: scores.bot + gained },
          false,
          2,
        );
        cells[i] = "";
        if (score > best) {
          best = score;
          bestI = i;
          bestM = mark;
        }
      }
    }
    cells[bestI] = bestM;
    return {
      ...state,
      cells,
      scores: { human: scores.human, bot: scores.bot + sosAt(cells, 4, bestI) },
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
    let bestI = -1;
    let bestM = "X";
    let best = -Infinity;
    const cells = [...state.cells];
    for (let i = 0; i < 36; i++) {
      if (cells[i] !== "") continue;
      for (const mark of ["X", "O"]) {
        cells[i] = mark;
        const score = chaosSearch(cells, false, 1);
        cells[i] = "";
        if (score > best) {
          best = score;
          bestI = i;
          bestM = mark;
        }
      }
    }
    if (bestI < 0) return state;
    cells[bestI] = bestM;
    return { ...state, cells };
  },
  status(state): EngineStatus {
    const w = nInRow(state.cells as Cell[], 6, 6, 5);
    if (w === "X" || w === "O") return "human_win";
    if (state.cells.every((c) => c !== "")) return "bot_win";
    return "playing";
  },
};

function sosSearch(
  cells: string[],
  scores: { human: number; bot: number },
  botTurn: boolean,
  depth: number,
): number {
  if (depth <= 0 || cells.every((c) => c !== "")) return scores.bot - scores.human;
  let value = botTurn ? -Infinity : Infinity;
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] !== "") continue;
    for (const mark of ["S", "O"]) {
      cells[i] = mark;
      const gained = sosAt(cells, 4, i);
      const next = botTurn
        ? { human: scores.human, bot: scores.bot + gained }
        : { human: scores.human + gained, bot: scores.bot };
      const score = sosSearch(cells, next, !botTurn, depth - 1);
      cells[i] = "";
      value = botTurn ? Math.max(value, score) : Math.min(value, score);
    }
  }
  return value;
}

function chaosSearch(cells: string[], botTurn: boolean, depth: number): number {
  const winner = nInRow(cells as Cell[], 6, 6, 5);
  if (winner === "X" || winner === "O") return -1000;
  if (cells.every((c) => c !== "")) return 1000;
  if (depth <= 0) return -longestRun(cells);
  let value = botTurn ? -Infinity : Infinity;
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] !== "") continue;
    for (const mark of ["X", "O"]) {
      cells[i] = mark;
      const score = chaosSearch(cells, !botTurn, depth - 1);
      cells[i] = "";
      value = botTurn ? Math.max(value, score) : Math.min(value, score);
    }
  }
  return value;
}

function longestRun(cells: string[]) {
  const cols = 6;
  let best = 0;
  const dirs = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ] as const;
  for (let i = 0; i < cells.length; i++) {
    const mark = cells[i];
    if (!mark) continue;
    const r = Math.floor(i / cols);
    const c = i % cols;
    for (const [dr, dc] of dirs) {
      let n = 1;
      let rr = r + dr;
      let cc = c + dc;
      while (rr >= 0 && rr < cols && cc >= 0 && cc < cols && cells[rr * cols + cc] === mark) {
        n++;
        rr += dr;
        cc += dc;
      }
      if (n > best) best = n;
    }
  }
  return best;
}

function legalMark(state: MarkState, move: MarkMove, marks: string[]) {
  return (
    Number.isInteger(move.index) &&
    move.index >= 0 &&
    move.index < state.cells.length &&
    marks.includes(move.mark) &&
    state.cells[move.index] === ""
  );
}

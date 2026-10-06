import type { EngineStatus, GameEngine, MoveResult } from "@arcade/game-core";
import {
  type Cell,
  lineWinner,
  nInRowWinner,
  placeEngine,
  randomEmpty,
  statusFromMark,
  tttLines,
} from "./helpers";

export { placeEngine } from "./helpers";

/* ---------- placement / n-in-a-row ---------- */

export const connectThreeEngine = placeEngine({
  id: "connectthree",
  name: "Connect Three",
  description: "5×5 grid — get three in a row before the bot.",
  size: 25,
  cols: 5,
  depth: 3,
  winner: (b) => nInRowWinner(b, 5, 5, 3),
});

export const gomokuEngine = placeEngine({
  id: "gomoku",
  name: "Gomoku",
  description: "9×9 five-in-a-row. You are X against a greedy arcade bot.",
  size: 81,
  cols: 9,
  depth: 1,
  winner: (b) => nInRowWinner(b, 9, 9, 5),
  score: (b) => {
    // prefer center
    let s = 0;
    if (b[40] === "O") s += 3;
    if (b[40] === "X") s -= 3;
    return s;
  },
});

export const misereTttEngine = (() => {
  const lines = tttLines();
  const winner = (board: Cell[]): "X" | "O" | "draw" | null => {
    // misère: completing a line LOSES
    const w = lineWinner(board, lines);
    if (w === "X") return "O"; // human made three → bot wins
    if (w === "O") return "X";
    if (board.every((c) => c !== "")) return "draw";
    return null;
  };
  return placeEngine({
    id: "miserettt",
    name: "Misère Tic-Tac-Toe",
    description: "Classic board, flipped rules — make three-in-a-row and you lose.",
    size: 9,
    cols: 3,
    depth: 5,
    winner,
  });
})();

/* ---------- wild tic-tac-toe (choose mark) ---------- */

type WildState = { kind: "wild"; cols: number; cells: Cell[] };
type WildMove = { index: number; mark: "X" | "O" };

function wildWinner(board: Cell[]): "X" | "O" | "draw" | null {
  const w = lineWinner(board, tttLines());
  if (w) return w;
  if (board.every((c) => c !== "")) return "draw";
  return null;
}

export const wildTttEngine: GameEngine<WildState, WildMove> = {
  id: "wildttt",
  name: "Wild Tic-Tac-Toe",
  description: "Place X or O on your turn — first completed line wins.",
  newState: () => ({ kind: "wild", cols: 3, cells: Array(9).fill("") as Cell[] }),
  applyHumanMove(state, move): MoveResult<WildState> {
    const { index, mark } = move;
    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index > 8 ||
      (mark !== "X" && mark !== "O") ||
      state.cells[index] !== "" ||
      wildWinner(state.cells)
    ) {
      return { state, illegal: true };
    }
    const cells = [...state.cells] as Cell[];
    cells[index] = mark;
    return { state: { ...state, cells } };
  },
  applyBotMove(state) {
    if (wildWinner(state.cells)) return state;
    // try win, then block, else random
    for (const mark of ["O", "X"] as const) {
      for (let i = 0; i < 9; i++) {
        if (state.cells[i] !== "") continue;
        const trial = [...state.cells] as Cell[];
        trial[i] = mark;
        if (wildWinner(trial) === mark) {
          return { ...state, cells: trial };
        }
      }
    }
    const i = randomEmpty(state.cells);
    if (i < 0) return state;
    const cells = [...state.cells] as Cell[];
    cells[i] = Math.random() < 0.5 ? "X" : "O";
    return { ...state, cells };
  },
  status(state) {
    return statusFromMark(wildWinner(state.cells));
  },
};

/* ---------- SOS ---------- */

type SosState = { kind: "sos"; cols: number; cells: string[]; scores: { human: number; bot: number } };
type SosMove = { index: number; mark: "S" | "O" };

function countSos(cells: string[], cols: number, around: number): number {
  const rows = cells.length / cols;
  let n = 0;
  const get = (r: number, c: number) =>
    r >= 0 && r < rows && c >= 0 && c < cols ? cells[r * cols + c] : null;
  const ar = Math.floor(around / cols);
  const ac = around % cols;
  for (const [dr, dc] of [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ] as const) {
    for (const mid of [0, 1, 2]) {
      const cells3 = [0, 1, 2].map((k) => {
        const r = ar + dr * (k - mid);
        const c = ac + dc * (k - mid);
        return get(r, c);
      });
      if (cells3[0] === "S" && cells3[1] === "O" && cells3[2] === "S") n++;
    }
  }
  return n;
}

export const sosEngine: GameEngine<SosState, SosMove> = {
  id: "sos",
  name: "SOS",
  description: "4×4 — place S or O. Score SOS lines; highest score wins.",
  newState: () => ({
    kind: "sos",
    cols: 4,
    cells: Array(16).fill(""),
    scores: { human: 0, bot: 0 },
  }),
  applyHumanMove(state, move): MoveResult<SosState> {
    const { index, mark } = move;
    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index > 15 ||
      (mark !== "S" && mark !== "O") ||
      state.cells[index] !== "" ||
      state.cells.every((c) => c !== "")
    ) {
      return { state, illegal: true };
    }
    const cells = [...state.cells];
    cells[index] = mark;
    const gained = countSos(cells, 4, index);
    return {
      state: {
        ...state,
        cells,
        scores: { ...state.scores, human: state.scores.human + gained },
      },
    };
  },
  applyBotMove(state) {
    if (state.cells.every((c) => c !== "")) return state;
    let best = { index: -1, mark: "S" as "S" | "O", score: -1 };
    for (let i = 0; i < 16; i++) {
      if (state.cells[i] !== "") continue;
      for (const mark of ["S", "O"] as const) {
        const cells = [...state.cells];
        cells[i] = mark;
        const g = countSos(cells, 4, i);
        if (g > best.score) best = { index: i, mark, score: g };
      }
    }
    if (best.index < 0) {
      best.index = state.cells.findIndex((c) => c === "");
      best.mark = "S";
      best.score = 0;
    }
    const cells = [...state.cells];
    cells[best.index] = best.mark;
    return {
      ...state,
      cells,
      scores: { ...state.scores, bot: state.scores.bot + Math.max(0, best.score) },
    };
  },
  status(state): EngineStatus {
    if (state.cells.some((c) => c === "")) return "playing";
    if (state.scores.human > state.scores.bot) return "human_win";
    if (state.scores.bot > state.scores.human) return "bot_win";
    return "draw";
  },
};

/* ---------- drop games (connect-style) ---------- */

function makeDropEngine(opts: {
  id: string;
  name: string;
  description: string;
  rows: number;
  cols: number;
  need: number;
  depth: number;
}): GameEngine<{ kind: "drop"; rows: number; cols: number; grid: number[] }, { column: number }> {
  const { rows, cols, need } = opts;
  const idx = (r: number, c: number) => r * cols + c;
  const empty = () => Array(rows * cols).fill(0) as number[];

  function drop(grid: number[], column: number, player: 1 | 2): number[] | null {
    if (column < 0 || column >= cols) return null;
    for (let r = rows - 1; r >= 0; r--) {
      if (grid[idx(r, column)] === 0) {
        const next = [...grid];
        next[idx(r, column)] = player;
        return next;
      }
    }
    return null;
  }

  function win(grid: number[], player: 1 | 2): boolean {
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

  function valid(grid: number[]) {
    return Array.from({ length: cols }, (_, c) => c).filter((c) => grid[idx(0, c)] === 0);
  }

  function botCol(grid: number[]): number {
    const colsAvail = valid(grid);
    // win / block
    for (const p of [2, 1] as const) {
      for (const c of colsAvail) {
        const next = drop(grid, c, p)!;
        if (win(next, p)) return c;
      }
    }
    return colsAvail[Math.floor(colsAvail.length / 2)] ?? colsAvail[0] ?? 0;
  }

  return {
    id: opts.id,
    name: opts.name,
    description: opts.description,
    newState: () => ({ kind: "drop", rows, cols, grid: empty() }),
    applyHumanMove(state, move): MoveResult<typeof state> {
      if (win(state.grid, 1) || win(state.grid, 2) || state.grid.every((x) => x !== 0)) {
        return { state, illegal: true };
      }
      const next = drop(state.grid, move.column, 1);
      if (!next) return { state, illegal: true };
      return { state: { ...state, grid: next } };
    },
    applyBotMove(state) {
      if (win(state.grid, 1) || win(state.grid, 2) || state.grid.every((x) => x !== 0)) return state;
      const next = drop(state.grid, botCol(state.grid), 2);
      return next ? { ...state, grid: next } : state;
    },
    status(state): EngineStatus {
      if (win(state.grid, 1)) return "human_win";
      if (win(state.grid, 2)) return "bot_win";
      if (state.grid.every((x) => x !== 0)) return "draw";
      return "playing";
    },
  };
}

export const popOutEngine = makeDropEngine({
  id: "popout",
  name: "Pop Out",
  description: "5×6 drop board — connect three vertically, horizontally, or diagonally.",
  rows: 5,
  cols: 6,
  need: 3,
  depth: 3,
});

export const powerFourEngine = makeDropEngine({
  id: "powerfour",
  name: "Power Four",
  description: "Compact 5×5 connect-four variant — four in a row wins.",
  rows: 5,
  cols: 5,
  need: 4,
  depth: 3,
});

/* ---------- Nim ---------- */

type NimState = { kind: "heaps"; heaps: number[]; last: "human" | "bot" | null };
type NimMove = { heap: number; take: number };

export const nimEngine: GameEngine<NimState, NimMove> = {
  id: "nim",
  name: "Nim",
  description: "Three heaps. Take any count from one heap — last object wins.",
  newState: () => ({ kind: "heaps", heaps: [3, 4, 5], last: null }),
  applyHumanMove(state, move): MoveResult<NimState> {
    const { heap, take } = move;
    if (
      !Number.isInteger(heap) ||
      !Number.isInteger(take) ||
      heap < 0 ||
      heap >= state.heaps.length ||
      take < 1 ||
      take > (state.heaps[heap] ?? 0)
    ) {
      return { state, illegal: true };
    }
    const heaps = [...state.heaps];
    heaps[heap]! -= take;
    return { state: { kind: "heaps", heaps, last: "human" } };
  },
  applyBotMove(state) {
    if (state.heaps.every((h) => h === 0)) return state;
    const xor = state.heaps.reduce((a, b) => a ^ b, 0);
    const heaps = [...state.heaps];
    if (xor === 0) {
      const heap = heaps.findIndex((h) => h > 0);
      heaps[heap]! -= 1;
    } else {
      for (let i = 0; i < heaps.length; i++) {
        const h = heaps[i]!;
        const target = h ^ xor;
        if (target < h) {
          heaps[i] = target;
          break;
        }
      }
    }
    return { kind: "heaps", heaps, last: "bot" };
  },
  status(state): EngineStatus {
    if (state.heaps.some((h) => h > 0)) return "playing";
    if (state.last === "human") return "human_win";
    if (state.last === "bot") return "bot_win";
    return "draw";
  },
};

/* ---------- Subtract a square ---------- */

type SubState = { kind: "number"; n: number; last: "human" | "bot" | null };
type SubMove = { take: number };

export const subtractSquareEngine: GameEngine<SubState, SubMove> = {
  id: "subtractsquare",
  name: "Subtract a Square",
  description: "Start at 30. Subtract a square number (1,4,9…). Last move wins.",
  newState: () => ({ kind: "number", n: 30, last: null }),
  applyHumanMove(state, move): MoveResult<SubState> {
    const sq = [1, 4, 9, 16, 25].filter((x) => x <= state.n);
    if (!sq.includes(move.take)) return { state, illegal: true };
    return { state: { kind: "number", n: state.n - move.take, last: "human" } };
  },
  applyBotMove(state) {
    if (state.n <= 0) return state;
    const sq = [1, 4, 9, 16, 25].filter((x) => x <= state.n);
    // cold positions: 0,2,5,7,10,12...
    for (const t of [...sq].reverse()) {
      const next = state.n - t;
      const cold = [0, 2, 5, 7, 10, 12, 15, 17, 20, 22, 24, 27];
      if (cold.includes(next)) return { kind: "number", n: next, last: "bot" };
    }
    return { kind: "number", n: state.n - sq[0]!, last: "bot" };
  },
  status(state): EngineStatus {
    if (state.n > 0) return "playing";
    if (state.last === "human") return "human_win";
    if (state.last === "bot") return "bot_win";
    return "draw";
  },
};

/* ---------- Reversi 6×6 ---------- */

type RevState = { kind: "reversi"; cols: number; cells: number[] }; // 0 empty 1 human 2 bot
type RevMove = { index: number };

const REV = 6;

function revFlips(cells: number[], index: number, player: 1 | 2): number[] {
  const opp = player === 1 ? 2 : 1;
  const r0 = Math.floor(index / REV);
  const c0 = index % REV;
  if (cells[index] !== 0) return [];
  const flips: number[] = [];
  for (const [dr, dc] of [
    [-1, -1],
    [-1, 0],
    [-1, 1],
    [0, -1],
    [0, 1],
    [1, -1],
    [1, 0],
    [1, 1],
  ] as const) {
    const path: number[] = [];
    let r = r0 + dr;
    let c = c0 + dc;
    while (r >= 0 && r < REV && c >= 0 && c < REV) {
      const i = r * REV + c;
      if (cells[i] === opp) path.push(i);
      else if (cells[i] === player && path.length) {
        flips.push(...path);
        break;
      } else break;
      r += dr;
      c += dc;
    }
  }
  return flips;
}

function revMoves(cells: number[], player: 1 | 2) {
  const out: number[] = [];
  for (let i = 0; i < REV * REV; i++) if (revFlips(cells, i, player).length) out.push(i);
  return out;
}

function revApply(cells: number[], index: number, player: 1 | 2) {
  const flips = revFlips(cells, index, player);
  if (!flips.length) return null;
  const next = [...cells];
  next[index] = player;
  for (const f of flips) next[f] = player;
  return next;
}

function revStart(): number[] {
  const cells = Array(REV * REV).fill(0);
  const m = REV / 2;
  cells[(m - 1) * REV + (m - 1)] = 2;
  cells[(m - 1) * REV + m] = 1;
  cells[m * REV + (m - 1)] = 1;
  cells[m * REV + m] = 2;
  return cells;
}

export const reversiEngine: GameEngine<RevState, RevMove> = {
  id: "reversi",
  name: "Reversi",
  description: "6×6 Othello — flank the bot's discs and flip them.",
  newState: () => ({ kind: "reversi", cols: REV, cells: revStart() }),
  applyHumanMove(state, move): MoveResult<RevState> {
    const next = revApply(state.cells, move.index, 1);
    if (!next) return { state, illegal: true };
    return { state: { ...state, cells: next } };
  },
  applyBotMove(state) {
    const moves = revMoves(state.cells, 2);
    if (!moves.length) return state;
    let best = moves[0]!;
    let bestN = -1;
    for (const m of moves) {
      const n = revFlips(state.cells, m, 2).length;
      if (n > bestN) {
        bestN = n;
        best = m;
      }
    }
    const next = revApply(state.cells, best, 2);
    return next ? { ...state, cells: next } : state;
  },
  status(state): EngineStatus {
    const hMoves = revMoves(state.cells, 1);
    const bMoves = revMoves(state.cells, 2);
    if (hMoves.length || bMoves.length) {
      // if human has no moves but bot does, still "playing" — but our turn model always human then bot.
      // If human can't move, applyHuman would fail — allow pass by not happening; treat as finished if both can't.
      if (!hMoves.length && !bMoves.length) {
        /* fall through */
      } else if (hMoves.length || bMoves.length) {
        // continue only if someone can move; if human has no moves game stalls — auto-pass: if no human moves, bot keeps... skip for simplicity end game when human has no moves after bot
        if (state.cells.includes(0) && (hMoves.length || bMoves.length)) {
          if (hMoves.length) return "playing";
          // human cannot move → resolve by disc count
        }
      }
    }
    if (hMoves.length) return "playing";
    const human = state.cells.filter((c) => c === 1).length;
    const bot = state.cells.filter((c) => c === 2).length;
    if (human > bot) return "human_win";
    if (bot > human) return "bot_win";
    return "draw";
  },
};

/* ---------- Hexapawn ---------- */

type HexState = { kind: "hexapawn"; cols: number; cells: number[] }; // 0 empty 1 human(↑) 2 bot(↓)
type HexMove = { from: number; to: number };

function hexMoves(cells: number[], player: 1 | 2): HexMove[] {
  const cols = 3;
  const out: HexMove[] = [];
  const dr = player === 1 ? -1 : 1;
  for (let i = 0; i < 9; i++) {
    if (cells[i] !== player) continue;
    const r = Math.floor(i / cols);
    const c = i % cols;
    const nr = r + dr;
    if (nr < 0 || nr > 2) continue;
    const ahead = nr * cols + c;
    if (cells[ahead] === 0) out.push({ from: i, to: ahead });
    for (const dc of [-1, 1]) {
      const nc = c + dc;
      if (nc < 0 || nc > 2) continue;
      const diag = nr * cols + nc;
      if (cells[diag] && cells[diag] !== player) out.push({ from: i, to: diag });
    }
  }
  return out;
}

export const hexapawnEngine: GameEngine<HexState, HexMove> = {
  id: "hexapawn",
  name: "Hexapawn",
  description: "3×3 pawn duel — advance or capture diagonally. Reach the end or trap the bot.",
  newState: () => ({
    kind: "hexapawn",
    cols: 3,
    cells: [2, 2, 2, 0, 0, 0, 1, 1, 1],
  }),
  applyHumanMove(state, move): MoveResult<HexState> {
    const legal = hexMoves(state.cells, 1);
    if (!legal.some((m) => m.from === move.from && m.to === move.to)) {
      return { state, illegal: true };
    }
    const cells = [...state.cells];
    cells[move.to] = 1;
    cells[move.from] = 0;
    return { state: { ...state, cells } };
  },
  applyBotMove(state) {
    const moves = hexMoves(state.cells, 2);
    if (!moves.length) return state;
    // prefer promotion / capture
    const promo = moves.find((m) => Math.floor(m.to / 3) === 2);
    const cap = moves.find((m) => state.cells[m.to] === 1);
    const pick = promo ?? cap ?? moves[Math.floor(Math.random() * moves.length)]!;
    const cells = [...state.cells];
    cells[pick.to] = 2;
    cells[pick.from] = 0;
    return { ...state, cells };
  },
  status(state): EngineStatus {
    if (state.cells.slice(0, 3).some((c) => c === 1)) return "human_win";
    if (state.cells.slice(6, 9).some((c) => c === 2)) return "bot_win";
    if (!hexMoves(state.cells, 1).length) return "bot_win";
    if (!hexMoves(state.cells, 2).length) return "human_win";
    return "playing";
  },
};

/* ---------- Mancala (simplified 6 pits) ---------- */

type ManState = {
  kind: "mancala";
  pits: number[]; // [h0..h5, hStore, b0..b5, bStore]
  last: "human" | "bot" | null;
};
type ManMove = { pit: number }; // 0..5 for current player side

export const mancalaEngine: GameEngine<ManState, ManMove> = {
  id: "mancala",
  name: "Mancala",
  description: "Sow seeds along your row. Capture and fill your store — most seeds wins.",
  newState: () => ({
    kind: "mancala",
    pits: [4, 4, 4, 4, 4, 4, 0, 4, 4, 4, 4, 4, 4, 0],
    last: null,
  }),
  applyHumanMove(state, move): MoveResult<ManState> {
    const pit = move.pit;
    if (!Number.isInteger(pit) || pit < 0 || pit > 5 || state.pits[pit] === 0) {
      return { state, illegal: true };
    }
    let pits = [...state.pits];
    let stones = pits[pit]!;
    pits[pit] = 0;
    let i = pit;
    while (stones > 0) {
      i = (i + 1) % 14;
      if (i === 13) continue; // skip bot store
      pits[i]! += 1;
      stones--;
    }
    // capture
    if (i <= 5 && pits[i] === 1) {
      const opp = 12 - i;
      if (pits[opp]! > 0) {
        pits[6]! += pits[opp]! + 1;
        pits[opp] = 0;
        pits[i] = 0;
      }
    }
    return { state: { kind: "mancala", pits, last: "human" } };
  },
  applyBotMove(state) {
    let best = -1;
    let bestStore = -1;
    for (let pit = 7; pit <= 12; pit++) {
      if (state.pits[pit] === 0) continue;
      const pits = [...state.pits];
      let stones = pits[pit]!;
      pits[pit] = 0;
      let i = pit;
      while (stones > 0) {
        i = (i + 1) % 14;
        if (i === 6) continue;
        pits[i]! += 1;
        stones--;
      }
      if (pits[13]! > bestStore) {
        bestStore = pits[13]!;
        best = pit;
      }
    }
    if (best < 0) return state;
    const pits = [...state.pits];
    let stones = pits[best]!;
    pits[best] = 0;
    let i = best;
    while (stones > 0) {
      i = (i + 1) % 14;
      if (i === 6) continue;
      pits[i]! += 1;
      stones--;
    }
    return { kind: "mancala", pits, last: "bot" };
  },
  status(state): EngineStatus {
    const humanEmpty = state.pits.slice(0, 6).every((x) => x === 0);
    const botEmpty = state.pits.slice(7, 13).every((x) => x === 0);
    if (!humanEmpty && !botEmpty) return "playing";
    const h = state.pits.slice(0, 6).reduce((a, b) => a + b, 0) + state.pits[6]!;
    const b = state.pits.slice(7, 13).reduce((a, b) => a + b, 0) + state.pits[13]!;
    if (h > b) return "human_win";
    if (b > h) return "bot_win";
    return "draw";
  },
};

/* ---------- Memory ---------- */

type MemState = {
  kind: "memory";
  cols: number;
  cards: number[];
  matched: boolean[];
  scores: { human: number; bot: number };
};
type MemMove = { a: number; b: number };

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export const memoryEngine: GameEngine<MemState, MemMove> = {
  id: "memory",
  name: "Memory",
  description: "4×4 pairs. Pick two cards — match to score. Most pairs wins.",
  newState: () => {
    const cards = shuffle([0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7]);
    return {
      kind: "memory",
      cols: 4,
      cards,
      matched: Array(16).fill(false),
      scores: { human: 0, bot: 0 },
    };
  },
  applyHumanMove(state, move): MoveResult<MemState> {
    const { a, b } = move;
    if (
      !Number.isInteger(a) ||
      !Number.isInteger(b) ||
      a === b ||
      a < 0 ||
      b < 0 ||
      a > 15 ||
      b > 15 ||
      state.matched[a] ||
      state.matched[b]
    ) {
      return { state, illegal: true };
    }
    const matched = [...state.matched];
    const scores = { ...state.scores };
    if (state.cards[a] === state.cards[b]) {
      matched[a] = matched[b] = true;
      scores.human += 1;
    }
    return { state: { ...state, matched, scores } };
  },
  applyBotMove(state) {
    if (state.scores.human + state.scores.bot >= 8) return state;
    const hidden = state.matched.map((m, i) => (!m ? i : -1)).filter((i) => i >= 0);
    if (hidden.length < 2) return state;
    for (const a of hidden) {
      for (const b of hidden) {
        if (a < b && state.cards[a] === state.cards[b]) {
          const matched = [...state.matched];
          matched[a] = matched[b] = true;
          return { ...state, matched, scores: { ...state.scores, bot: state.scores.bot + 1 } };
        }
      }
    }
    const a = hidden[0]!;
    const b = hidden[1]!;
    const matched = [...state.matched];
    const scores = { ...state.scores };
    if (state.cards[a] === state.cards[b]) {
      matched[a] = matched[b] = true;
      scores.bot += 1;
    }
    return { ...state, matched, scores };
  },
  status(state): EngineStatus {
    if (state.scores.human + state.scores.bot < 8) return "playing";
    if (state.scores.human > state.scores.bot) return "human_win";
    if (state.scores.bot > state.scores.human) return "bot_win";
    return "draw";
  },
};

/* ---------- Order & Chaos (6×6, five in a row) ---------- */

type OcState = { kind: "orderchaos"; cols: number; cells: Cell[] };
type OcMove = { index: number; mark: "X" | "O" };

function ocLine(board: Cell[]): boolean {
  return nInRowWinner(board, 6, 6, 5) !== null && nInRowWinner(board, 6, 6, 5) !== "draw";
}

export const orderChaosEngine: GameEngine<OcState, OcMove> = {
  id: "orderchaos",
  name: "Order & Chaos",
  description: "You are Order — place X or O to make five-in-a-row. Bot is Chaos.",
  newState: () => ({ kind: "orderchaos", cols: 6, cells: Array(36).fill("") as Cell[] }),
  applyHumanMove(state, move): MoveResult<OcState> {
    const { index, mark } = move;
    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index > 35 ||
      (mark !== "X" && mark !== "O") ||
      state.cells[index] !== ""
    ) {
      return { state, illegal: true };
    }
    const cells = [...state.cells] as Cell[];
    cells[index] = mark;
    return { state: { ...state, cells } };
  },
  applyBotMove(state) {
    if (ocLine(state.cells) || state.cells.every((c) => c !== "")) return state;
    // block threats of 4
    for (const mark of ["X", "O"] as const) {
      for (let i = 0; i < 36; i++) {
        if (state.cells[i] !== "") continue;
        const trial = [...state.cells] as Cell[];
        trial[i] = mark;
        if (nInRowWinner(trial, 6, 6, 5) === mark) {
          // Order would win — Chaos places opposite there? Chaos places any mark to break
          const cells = [...state.cells] as Cell[];
          cells[i] = mark === "X" ? "O" : "X";
          // if that still completes, place mark itself as chaos disruption — place random other
          if (nInRowWinner(cells, 6, 6, 5)) {
            cells[i] = mark;
          }
          return { ...state, cells };
        }
      }
    }
    const i = randomEmpty(state.cells);
    if (i < 0) return state;
    const cells = [...state.cells] as Cell[];
    cells[i] = Math.random() < 0.5 ? "X" : "O";
    return { ...state, cells };
  },
  status(state): EngineStatus {
    const w = nInRowWinner(state.cells, 6, 6, 5);
    if (w === "X" || w === "O") return "human_win"; // Order wins
    if (state.cells.every((c) => c !== "")) return "bot_win"; // Chaos wins by filling
    return "playing";
  },
};

/* ---------- Dots & Boxes (2×2 boxes = 3×3 dots) ---------- */

type BoxState = {
  kind: "boxes";
  size: number; // boxes per side
  h: boolean[]; // horizontal edges (size+1)*size? for 2 boxes: 3 rows of 2 h-edges → 3*2=6; wait
  v: boolean[];
  owner: number[]; // box owner 0 none 1 human 2 bot
  scores: { human: number; bot: number };
  last: "human" | "bot" | null;
};
type BoxMove = { dir: "h" | "v"; index: number };

function boxesComplete(
  h: boolean[],
  v: boolean[],
  size: number,
  owner: number[],
  player: 1 | 2,
): { owner: number[]; gained: number } {
  const next = [...owner];
  let gained = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const bi = r * size + c;
      if (next[bi]) continue;
      const top = h[r * size + c]!;
      const bot = h[(r + 1) * size + c]!;
      const left = v[r * (size + 1) + c]!;
      const right = v[r * (size + 1) + c + 1]!;
      if (top && bot && left && right) {
        next[bi] = player;
        gained++;
      }
    }
  }
  return { owner: next, gained };
}

export const dotsBoxesEngine: GameEngine<BoxState, BoxMove> = {
  id: "dotsboxes",
  name: "Dots & Boxes",
  description: "Claim sides on a 2×2 grid of boxes. Close a box to score.",
  newState: () => {
    const size = 2;
    return {
      kind: "boxes",
      size,
      h: Array((size + 1) * size).fill(false),
      v: Array(size * (size + 1)).fill(false),
      owner: Array(size * size).fill(0),
      scores: { human: 0, bot: 0 },
      last: null,
    };
  },
  applyHumanMove(state, move): MoveResult<BoxState> {
    if (move.dir === "h") {
      if (move.index < 0 || move.index >= state.h.length || state.h[move.index]) {
        return { state, illegal: true };
      }
      const h = [...state.h];
      h[move.index] = true;
      const { owner, gained } = boxesComplete(h, state.v, state.size, state.owner, 1);
      return {
        state: {
          ...state,
          h,
          owner,
          scores: { ...state.scores, human: state.scores.human + gained },
          last: "human",
        },
      };
    }
    if (move.index < 0 || move.index >= state.v.length || state.v[move.index]) {
      return { state, illegal: true };
    }
    const v = [...state.v];
    v[move.index] = true;
    const { owner, gained } = boxesComplete(state.h, v, state.size, state.owner, 1);
    return {
      state: {
        ...state,
        v,
        owner,
        scores: { ...state.scores, human: state.scores.human + gained },
        last: "human",
      },
    };
  },
  applyBotMove(state) {
    const options: BoxMove[] = [];
    state.h.forEach((taken, index) => {
      if (!taken) options.push({ dir: "h", index });
    });
    state.v.forEach((taken, index) => {
      if (!taken) options.push({ dir: "v", index });
    });
    if (!options.length) return state;

    // prefer completing a box
    for (const m of options) {
      const h = [...state.h];
      const v = [...state.v];
      if (m.dir === "h") h[m.index] = true;
      else v[m.index] = true;
      const { gained } = boxesComplete(h, v, state.size, state.owner, 2);
      if (gained) {
        const { owner } = boxesComplete(h, v, state.size, state.owner, 2);
        return {
          ...state,
          h,
          v,
          owner,
          scores: { ...state.scores, bot: state.scores.bot + gained },
          last: "bot",
        };
      }
    }
    const m = options[Math.floor(Math.random() * options.length)]!;
    const h = [...state.h];
    const v = [...state.v];
    if (m.dir === "h") h[m.index] = true;
    else v[m.index] = true;
    const { owner, gained } = boxesComplete(h, v, state.size, state.owner, 2);
    return {
      ...state,
      h,
      v,
      owner,
      scores: { ...state.scores, bot: state.scores.bot + gained },
      last: "bot",
    };
  },
  status(state): EngineStatus {
    if (state.owner.some((o) => o === 0)) return "playing";
    if (state.scores.human > state.scores.bot) return "human_win";
    if (state.scores.bot > state.scores.human) return "bot_win";
    return "draw";
  },
};

/* ---------- export suite ---------- */

export const suiteEngines = [
  connectThreeEngine,
  gomokuEngine,
  misereTttEngine,
  wildTttEngine,
  sosEngine,
  popOutEngine,
  powerFourEngine,
  nimEngine,
  subtractSquareEngine,
  reversiEngine,
  hexapawnEngine,
  mancalaEngine,
  memoryEngine,
  orderChaosEngine,
  dotsBoxesEngine,
];

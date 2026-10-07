import { nInRow, placeEngine, threatMove, type Cell, type CellState } from "../lib/line";
import type { BotDifficulty, GameEngine } from "@arcade/game-core";

export const connectThreeEngine = placeEngine({
  id: "connectthree",
  name: "Connect Three",
  description: "5×5 board. Three in a row wins.",
  rules: "Tap an empty cell to place X. The bot places O. Get three in a row, column, or diagonal.",
  size: 25,
  cols: 5,
  depth: 3,
  winner: (b) => nInRow(b, 5, 5, 3),
});

const gomokuBase = placeEngine({
  id: "gomoku",
  name: "Gomoku",
  description: "9×9 five-in-a-row.",
  rules: "Tap an empty intersection to place X. Five in a row — any direction — wins. The bot scores nearby threats and answers the strongest one.",
  size: 81,
  cols: 9,
  depth: 1,
  winner: (b) => nInRow(b, 9, 9, 5),
});

/** 9×9 is too wide to solve. The bot scores every nearby cell and answers the strongest threat. */
export const gomokuEngine: GameEngine<CellState, { index: number }> = {
  ...gomokuBase,
  applyBotMove(state, difficulty?: BotDifficulty) {
    if (nInRow(state.cells, 9, 9, 5)) return state;
    const move =
      difficulty === "easy" ? threatMove(state.cells, 9, 9, 5) : bestGomoku(state.cells, difficulty);
    if (move < 0) return state;
    const cells = [...state.cells] as Cell[];
    cells[move] = "O";
    return { ...state, cells };
  },
};

function bestGomoku(board: Cell[], difficulty?: BotDifficulty) {
  const blockBonus = difficulty === "nightmare" ? 9000 : difficulty === "hard" ? 7000 : 5000;
  const cols = 9;
  const near = new Set<number>();
  for (let i = 0; i < board.length; i++) {
    if (!board[i]) continue;
    const r = Math.floor(i / cols);
    const c = i % cols;
    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        const rr = r + dr;
        const cc = c + dc;
        if (rr < 0 || rr >= cols || cc < 0 || cc >= cols) continue;
        const j = rr * cols + cc;
        if (board[j] === "") near.add(j);
      }
    }
  }
  if (!near.size) near.add(4 * cols + 4);
  let best = -1;
  let bestScore = -Infinity;
  for (const i of near) {
    const trial = [...board] as Cell[];
    trial[i] = "O";
    if (nInRow(trial, 9, 9, 5) === "O") return i;
    trial[i] = "X";
    const block = nInRow(trial, 9, 9, 5) === "X" ? blockBonus : 0;
    trial[i] = "O";
    const score = block + windowScore(trial, "O") - windowScore(trial, "X");
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

function windowScore(board: Cell[], mark: Cell) {
  const cols = 9;
  const n = 5;
  let score = 0;
  const dirs = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ] as const;
  for (let r = 0; r < cols; r++) {
    for (let c = 0; c < cols; c++) {
      for (const [dr, dc] of dirs) {
        const cells: Cell[] = [];
        let ok = true;
        for (let k = 0; k < n; k++) {
          const rr = r + dr * k;
          const cc = c + dc * k;
          if (rr < 0 || rr >= cols || cc < 0 || cc >= cols) {
            ok = false;
            break;
          }
          cells.push(board[rr * cols + cc] ?? "");
        }
        if (!ok) continue;
        const mine = cells.filter((x) => x === mark).length;
        const empty = cells.filter((x) => x === "").length;
        if (mine + empty !== n) continue;
        if (mine === 4) score += 80;
        else if (mine === 3) score += 16;
        else if (mine === 2) score += 4;
      }
    }
  }
  return score;
}

export const misereTttEngine = placeEngine({
  id: "miserettt",
  name: "Misère Tic-Tac-Toe",
  description: "Same 3×3 board — three in a row loses.",
  rules: "Place X on an empty square. Completing a line of three loses, so force the bot to make the line. A full board with no line is a draw.",
  size: 9,
  cols: 3,
  depth: 6,
  winner: (board) => {
    const lines = [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8],
      [0, 3, 6],
      [1, 4, 7],
      [2, 5, 8],
      [0, 4, 8],
      [2, 4, 6],
    ];
    for (const line of lines) {
      const mark = board[line[0]!];
      if (mark && line.every((i) => board[i] === mark)) {
        return mark === "X" ? "O" : "X";
      }
    }
    if (board.every((c) => c !== "")) return "draw";
    return null;
  },
});

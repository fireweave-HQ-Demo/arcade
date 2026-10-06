import { nInRow, placeEngine, threatMove, type Cell, type CellState } from "../lib/line";
import type { GameEngine } from "@arcade/game-core";

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
  rules: "Tap an empty intersection to place X. Five in a row — any direction — wins. The bot blocks open threats and prefers the center.",
  size: 81,
  cols: 9,
  depth: 1,
  winner: (b) => nInRow(b, 9, 9, 5),
});

/** Large board: win/block/center instead of a full search. */
export const gomokuEngine: GameEngine<CellState, { index: number }> = {
  ...gomokuBase,
  applyBotMove(state) {
    if (nInRow(state.cells, 9, 9, 5)) return state;
    const move = threatMove(state.cells, 9, 9, 5);
    if (move < 0) return state;
    const cells = [...state.cells] as Cell[];
    cells[move] = "O";
    return { ...state, cells };
  },
};

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

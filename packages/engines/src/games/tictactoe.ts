import type { EngineStatus, GameEngine, MoveResult } from "@arcade/game-core";

export type Cell = "X" | "O" | "";
export type TttState = { board: Cell[] };
export type TttMove = { index: number };

const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
] as const;

function winner(board: Cell[]): "X" | "O" | "draw" | null {
  for (const [a, b, c] of LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a] as "X" | "O";
    }
  }
  if (board.every((c) => c !== "")) return "draw";
  return null;
}

function minimax(board: Cell[], isMax: boolean): number {
  const w = winner(board);
  if (w === "O") return 10;
  if (w === "X") return -10;
  if (w === "draw") return 0;

  if (isMax) {
    let best = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] !== "") continue;
      board[i] = "O";
      best = Math.max(best, minimax(board, false));
      board[i] = "";
    }
    return best;
  }

  let best = Infinity;
  for (let i = 0; i < 9; i++) {
    if (board[i] !== "") continue;
    board[i] = "X";
    best = Math.min(best, minimax(board, true));
    board[i] = "";
  }
  return best;
}

function bestBotMove(board: Cell[]): number {
  let move = -1;
  let bestScore = -Infinity;
  const copy = [...board];
  for (let i = 0; i < 9; i++) {
    if (copy[i] !== "") continue;
    copy[i] = "O";
    const score = minimax(copy, false);
    copy[i] = "";
    if (score > bestScore) {
      bestScore = score;
      move = i;
    }
  }
  return move;
}

export const ticTacToeEngine: GameEngine<TttState, TttMove> = {
  id: "tictactoe",
  name: "Tic-Tac-Toe",
  description: "Classic 3×3. You are X against a perfect bot.",
  rules: "Tap an empty square to place X. The bot answers with O. Line up three in a row, column, or diagonal. A full board with no line is a draw.",
  newState: () => ({ board: Array(9).fill("") as Cell[] }),
  applyHumanMove(state, move): MoveResult<TttState> {
    const { index } = move;
    if (!Number.isInteger(index) || index < 0 || index > 8 || state.board[index] !== "") {
      return { state, illegal: true };
    }
    if (winner(state.board)) return { state, illegal: true };
    const board = [...state.board] as Cell[];
    board[index] = "X";
    return { state: { board } };
  },
  applyBotMove(state) {
    if (winner(state.board)) return state;
    const move = bestBotMove(state.board);
    if (move < 0) return state;
    const board = [...state.board] as Cell[];
    board[move] = "O";
    return { board };
  },
  status(state): EngineStatus {
    const w = winner(state.board);
    if (w === "X") return "human_win";
    if (w === "O") return "bot_win";
    if (w === "draw") return "draw";
    return "playing";
  },
};

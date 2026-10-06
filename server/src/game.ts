export type Cell = "X" | "O" | "";
export type Board = Cell[];
export type Winner = "X" | "O" | "draw" | null;

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

export function emptyBoard(): Board {
  return ["", "", "", "", "", "", "", "", ""];
}

export function getWinner(board: Board): Winner {
  for (const [a, b, c] of LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a] as "X" | "O";
    }
  }
  if (board.every((c) => c !== "")) return "draw";
  return null;
}

function minimax(board: Board, isMax: boolean): number {
  const winner = getWinner(board);
  if (winner === "O") return 10;
  if (winner === "X") return -10;
  if (winner === "draw") return 0;

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

/** Perfect play for O (temp-battle bot). Returns best cell index. */
export function bestMove(board: Board): number {
  let move = -1;
  let bestScore = -Infinity;
  const copy = [...board] as Board;

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

export function applyHumanMove(board: Board, index: number): Board | null {
  if (index < 0 || index > 8 || board[index] !== "") return null;
  if (getWinner(board)) return null;
  const next = [...board] as Board;
  next[index] = "X";
  return next;
}

export function applyBotMove(board: Board): Board {
  if (getWinner(board)) return board;
  const move = bestMove(board);
  if (move < 0) return board;
  const next = [...board] as Board;
  next[move] = "O";
  return next;
}

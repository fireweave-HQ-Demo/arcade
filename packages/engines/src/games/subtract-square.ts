import type { BotDifficulty, EngineStatus, GameEngine, MoveResult } from "@arcade/game-core";

type State = { kind: "number"; n: number; last: "human" | "bot" | null };
type Move = { take: number };

const SQUARES = [1, 4, 9, 16, 25];
/** Known cold positions up to 30 — moving to one leaves the opponent losing with perfect play. */
const COLD = new Set([0, 2, 5, 7, 10, 12, 15, 17, 20, 22, 24, 27]);

export const subtractSquareEngine: GameEngine<State, Move> = {
  id: "subtractsquare",
  name: "Subtract a Square",
  description: "Start at 30. Subtract a square. Reach 0 to win.",
  rules: "The pile starts at 30. Subtract a perfect square that is not larger than the pile (1, 4, 9, 16, or 25). The player who reaches exactly 0 wins.",
  newState: () => ({ kind: "number", n: 30, last: null }),
  applyHumanMove(state, move): MoveResult<State> {
    if (!SQUARES.includes(move.take) || move.take > state.n) return { state, illegal: true };
    return { state: { kind: "number", n: state.n - move.take, last: "human" } };
  },
  applyBotMove(state, difficulty?: BotDifficulty) {
    if (state.n <= 0) return state;
    const options = SQUARES.filter((x) => x <= state.n);
    if (difficulty === "easy") {
      const take = options[options.length - 1]!;
      return { kind: "number", n: state.n - take, last: "bot" };
    }
    const colds = options.filter((t) => COLD.has(state.n - t));
    const take =
      difficulty === "hard" || difficulty === "nightmare"
        ? (colds[colds.length - 1] ?? options[options.length - 1]!)
        : (colds[0] ?? options[options.length - 1]!);
    return { kind: "number", n: state.n - take, last: "bot" };
  },
  status(state): EngineStatus {
    if (state.n > 0) return "playing";
    if (state.last === "human") return "human_win";
    if (state.last === "bot") return "bot_win";
    return "draw";
  },
};

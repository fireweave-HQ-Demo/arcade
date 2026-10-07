import type { BotDifficulty, EngineStatus, GameEngine, MoveResult } from "@arcade/game-core";

type State = { kind: "heaps"; heaps: number[]; last: "human" | "bot" | null };
type Move = { heap: number; take: number };

export const nimEngine: GameEngine<State, Move> = {
  id: "nim",
  name: "Nim",
  description: "Three heaps. Take the last object to win.",
  rules: "Heaps start at 3, 4, and 5. On your turn remove any number from a single heap. The player who takes the last object wins. The bot plays perfect Nim (xor strategy).",
  newState: () => ({ kind: "heaps", heaps: [3, 4, 5], last: null }),
  applyHumanMove(state, move): MoveResult<State> {
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
  applyBotMove(state, difficulty?: BotDifficulty) {
    if (state.heaps.every((h) => h === 0)) return state;
    const heaps = [...state.heaps];
    if (difficulty === "easy") {
      let heap = 0;
      for (let i = 1; i < heaps.length; i++) if (heaps[i]! > heaps[heap]!) heap = i;
      heaps[heap]! -= 1;
      return { kind: "heaps", heaps, last: "bot" };
    }
    const xor = heaps.reduce((a, b) => a ^ b, 0);
    if (xor === 0) {
      const heap = heaps.findIndex((h) => h > 0);
      heaps[heap]! -= 1;
    } else if (difficulty === "nightmare") {
      let best = -1;
      let take = 0;
      for (let i = 0; i < heaps.length; i++) {
        const target = heaps[i]! ^ xor;
        if (target < heaps[i]! && heaps[i]! - target > take) {
          take = heaps[i]! - target;
          best = i;
        }
      }
      if (best >= 0) heaps[best] = heaps[best]! ^ xor;
    } else {
      for (let i = 0; i < heaps.length; i++) {
        const target = heaps[i]! ^ xor;
        if (target < heaps[i]!) {
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

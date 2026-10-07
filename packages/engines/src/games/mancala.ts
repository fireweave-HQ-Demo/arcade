import type { EngineStatus, GameEngine, MoveResult } from "@arcade/game-core";

/** pits: 0-5 human, 6 human store, 7-12 bot, 13 bot store */
type State = { kind: "mancala"; pits: number[] };
type Move = { pit: number };

function sow(pits: number[], pit: number, skip: number): number[] {
  const next = [...pits];
  let stones = next[pit] ?? 0;
  next[pit] = 0;
  let i = pit;
  while (stones > 0) {
    i = (i + 1) % 14;
    if (i === skip) continue;
    next[i] = (next[i] ?? 0) + 1;
    stones--;
  }
  return next;
}

export const mancalaEngine: GameEngine<State, Move> = {
  id: "mancala",
  name: "Mancala",
  description: "Sow seeds. Fill your store.",
  rules: "Your pits are the bottom row, four seeds each. Tap a pit to sow counter-clockwise, skipping the bot's store. If the last seed lands in an empty pit of yours, you capture that seed and the opposite pit. Most seeds in your store when one side is empty wins. Extra turns are not used — play alternates.",
  newState: () => ({
    kind: "mancala",
    pits: [4, 4, 4, 4, 4, 4, 0, 4, 4, 4, 4, 4, 4, 0],
  }),
  applyHumanMove(state, move): MoveResult<State> {
    const pit = move.pit;
    if (!Number.isInteger(pit) || pit < 0 || pit > 5 || state.pits[pit] === 0) {
      return { state, illegal: true };
    }
    return { state: { kind: "mancala", pits: play(state.pits, pit, "human") } };
  },
  applyBotMove(state) {
    let best = -1;
    let bestScore = -Infinity;
    for (let pit = 7; pit <= 12; pit++) {
      if (!state.pits[pit]) continue;
      const pits = play(state.pits, pit, "bot");
      const score = search(pits, "human", 5, -Infinity, Infinity);
      if (score > bestScore) {
        bestScore = score;
        best = pit;
      }
    }
    if (best < 0) return state;
    return { kind: "mancala", pits: play(state.pits, best, "bot") };
  },
  status(state): EngineStatus {
    const humanEmpty = state.pits.slice(0, 6).every((x) => x === 0);
    const botEmpty = state.pits.slice(7, 13).every((x) => x === 0);
    if (!humanEmpty && !botEmpty) return "playing";
    const h = state.pits.slice(0, 7).reduce((a, b) => a + b, 0);
    const b = state.pits.slice(7).reduce((a, b) => a + b, 0);
    if (h > b) return "human_win";
    if (b > h) return "bot_win";
    return "draw";
  },
};

function play(pits: number[], pit: number, side: "human" | "bot") {
  const skip = side === "human" ? 13 : 6;
  const next = sow(pits, pit, skip);
  const last = lastIndex(pits, pit, skip);
  const own = side === "human" ? last <= 5 : last >= 7 && last <= 12;
  const store = side === "human" ? 6 : 13;
  if (own && next[last] === 1 && (next[12 - last] ?? 0) > 0) {
    next[store] = (next[store] ?? 0) + (next[12 - last] ?? 0) + 1;
    next[12 - last] = 0;
    next[last] = 0;
  }
  return next;
}

function ended(pits: number[]) {
  return pits.slice(0, 6).every((x) => x === 0) || pits.slice(7, 13).every((x) => x === 0);
}

function valueOf(pits: number[]) {
  const human = pits.slice(0, 7).reduce((a, b) => a + b, 0);
  const bot = pits.slice(7).reduce((a, b) => a + b, 0);
  return bot - human;
}

function search(
  pits: number[],
  side: "human" | "bot",
  depth: number,
  alpha: number,
  beta: number,
): number {
  if (depth <= 0 || ended(pits)) return valueOf(pits);
  const pitsRange = side === "human" ? [0, 5] : [7, 12];
  let value = side === "bot" ? -Infinity : Infinity;
  let moved = false;
  for (let pit = pitsRange[0]!; pit <= pitsRange[1]!; pit++) {
    if (!pits[pit]) continue;
    moved = true;
    const next = play(pits, pit, side);
    const score = search(next, side === "bot" ? "human" : "bot", depth - 1, alpha, beta);
    if (side === "bot") {
      value = Math.max(value, score);
      alpha = Math.max(alpha, value);
    } else {
      value = Math.min(value, score);
      beta = Math.min(beta, value);
    }
    if (alpha >= beta) break;
  }
  return moved ? value : valueOf(pits);
}

function lastIndex(pits: number[], start: number, skip: number) {
  let stones = pits[start] ?? 0;
  let i = start;
  while (stones > 0) {
    i = (i + 1) % 14;
    if (i === skip) continue;
    stones--;
  }
  return i;
}

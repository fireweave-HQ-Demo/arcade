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
    const pits = sow(state.pits, pit, 13);
    const last = lastIndex(state.pits, pit, 13);
    if (last <= 5 && pits[last] === 1 && (pits[12 - last] ?? 0) > 0) {
      pits[6] = (pits[6] ?? 0) + (pits[12 - last] ?? 0) + 1;
      pits[12 - last] = 0;
      pits[last] = 0;
    }
    return { state: { kind: "mancala", pits } };
  },
  applyBotMove(state) {
    let best = -1;
    let bestStore = -1;
    for (let pit = 7; pit <= 12; pit++) {
      if (!state.pits[pit]) continue;
      const pits = sow(state.pits, pit, 6);
      if ((pits[13] ?? 0) > bestStore) {
        bestStore = pits[13] ?? 0;
        best = pit;
      }
    }
    if (best < 0) return state;
    return { kind: "mancala", pits: sow(state.pits, best, 6) };
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

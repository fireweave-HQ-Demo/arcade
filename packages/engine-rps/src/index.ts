import type { EngineStatus, GameEngine, MoveResult } from "@arcade/game-core";

export type RpsChoice = "rock" | "paper" | "scissors";
export type RpsState = {
  human: RpsChoice | null;
  bot: RpsChoice | null;
  history: RpsChoice[]; // recent human picks for adaptive bot
};
export type RpsMove = { choice: RpsChoice };

const BEATS: Record<RpsChoice, RpsChoice> = {
  rock: "scissors",
  paper: "rock",
  scissors: "paper",
};

const ALL: RpsChoice[] = ["rock", "paper", "scissors"];

function decide(human: RpsChoice, bot: RpsChoice): EngineStatus {
  if (human === bot) return "draw";
  return BEATS[human] === bot ? "human_win" : "bot_win";
}

/** Counter the player's most frequent recent choice; slight randomness. */
function botPick(history: RpsChoice[]): RpsChoice {
  if (history.length === 0) return ALL[Math.floor(Math.random() * 3)]!;
  const counts: Record<RpsChoice, number> = { rock: 0, paper: 0, scissors: 0 };
  for (const h of history.slice(-8)) counts[h]++;
  const favorite = (Object.entries(counts) as [RpsChoice, number][]).sort(
    (a, b) => b[1] - a[1],
  )[0]![0];
  // play what beats favorite
  const counter = (Object.entries(BEATS) as [RpsChoice, RpsChoice][]).find(
    ([, losesTo]) => losesTo === favorite,
  )![0];
  // 15% random to avoid being fully predictable
  if (Math.random() < 0.15) return ALL[Math.floor(Math.random() * 3)]!;
  return counter;
}

export const rpsEngine: GameEngine<RpsState, RpsMove> = {
  id: "rps",
  name: "Rock Paper Scissors",
  description: "Best of one vs an adaptive arcade bot.",
  newState: () => ({ human: null, bot: null, history: [] }),
  applyHumanMove(state, move): MoveResult<RpsState> {
    if (!ALL.includes(move.choice)) return { state, illegal: true };
    if (state.human !== null) return { state, illegal: true };
    return {
      state: {
        ...state,
        human: move.choice,
        history: [...state.history, move.choice],
      },
    };
  },
  applyBotMove(state) {
    if (state.human === null || state.bot !== null) return state;
    return { ...state, bot: botPick(state.history.slice(0, -1)) };
  },
  status(state): EngineStatus {
    if (state.human === null || state.bot === null) return "playing";
    return decide(state.human, state.bot);
  },
};

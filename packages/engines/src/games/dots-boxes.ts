import type { BotDifficulty, EngineStatus, GameEngine, MoveResult } from "@arcade/game-core";

type State = {
  kind: "boxes";
  size: number;
  h: boolean[];
  v: boolean[];
  owner: number[];
  scores: { human: number; bot: number };
};
type Move = { dir: "h" | "v"; index: number };

function bestMove(
  state: State,
  options: Move[],
  apply: (m: Move) => { h: boolean[]; v: boolean[]; owner: number[]; gained: number },
  difficulty?: BotDifficulty,
): Move {
  if (difficulty === "easy") return options[0]!;
  const handedWeight = difficulty === "nightmare" ? 180 : difficulty === "hard" ? 90 : 40;
  let best = options[0]!;
  let bestScore = -Infinity;
  for (const move of options) {
    const played = apply(move);
    const next: State = {
      ...state,
      h: played.h,
      v: played.v,
      owner: played.owner,
      scores: { ...state.scores, bot: state.scores.bot + played.gained },
    };
    const handed = maxGain(next, 1);
    const score = played.gained * 100 - handed * handedWeight - openThirds(next);
    if (score > bestScore) {
      bestScore = score;
      best = move;
    }
  }
  return best;
}

function maxGain(state: State, player: 1 | 2): number {
  let best = 0;
  const scan = (dir: "h" | "v", edges: boolean[]) => {
    edges.forEach((taken, index) => {
      if (taken) return;
      const h = [...state.h];
      const v = [...state.v];
      if (dir === "h") h[index] = true;
      else v[index] = true;
      best = Math.max(best, claim(h, v, state.size, state.owner, player).gained);
    });
  };
  scan("h", state.h);
  scan("v", state.v);
  return best;
}

function openThirds(state: State): number {
  let n = 0;
  for (let r = 0; r < state.size; r++) {
    for (let c = 0; c < state.size; c++) {
      if (state.owner[r * state.size + c]) continue;
      const sides =
        Number(state.h[r * state.size + c]) +
        Number(state.h[(r + 1) * state.size + c]) +
        Number(state.v[r * (state.size + 1) + c]) +
        Number(state.v[r * (state.size + 1) + c + 1]);
      if (sides === 3) n++;
    }
  }
  return n;
}

function claim(h: boolean[], v: boolean[], size: number, owner: number[], player: 1 | 2) {
  const next = [...owner];
  let gained = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const bi = r * size + c;
      if (next[bi]) continue;
      const top = h[r * size + c];
      const bottom = h[(r + 1) * size + c];
      const left = v[r * (size + 1) + c];
      const right = v[r * (size + 1) + c + 1];
      if (top && bottom && left && right) {
        next[bi] = player;
        gained++;
      }
    }
  }
  return { owner: next, gained };
}

export const dotsBoxesEngine: GameEngine<State, Move> = {
  id: "dotsboxes",
  name: "Dots & Boxes",
  description: "Draw edges. Close a box to claim it.",
  rules: "Tap a missing line between the dots. When your line closes a square, it is yours. Most boxes on the 2×2 grid wins. The bot takes a box when it can and will not hand you the next one.",
  newState: () => {
    const size = 2;
    return {
      kind: "boxes",
      size,
      h: Array((size + 1) * size).fill(false),
      v: Array(size * (size + 1)).fill(false),
      owner: Array(size * size).fill(0),
      scores: { human: 0, bot: 0 },
    };
  },
  applyHumanMove(state, move): MoveResult<State> {
    const edges = move.dir === "h" ? state.h : state.v;
    if (move.dir !== "h" && move.dir !== "v") return { state, illegal: true };
    if (!Number.isInteger(move.index) || move.index < 0 || move.index >= edges.length || edges[move.index]) {
      return { state, illegal: true };
    }
    const h = [...state.h];
    const v = [...state.v];
    if (move.dir === "h") h[move.index] = true;
    else v[move.index] = true;
    const { owner, gained } = claim(h, v, state.size, state.owner, 1);
    return {
      state: {
        ...state,
        h,
        v,
        owner,
        scores: { ...state.scores, human: state.scores.human + gained },
      },
    };
  },
  applyBotMove(state, difficulty?: BotDifficulty) {
    const options: Move[] = [];
    state.h.forEach((taken, index) => {
      if (!taken) options.push({ dir: "h", index });
    });
    state.v.forEach((taken, index) => {
      if (!taken) options.push({ dir: "v", index });
    });
    if (!options.length) return state;

    const apply = (m: Move) => {
      const h = [...state.h];
      const v = [...state.v];
      if (m.dir === "h") h[m.index] = true;
      else v[m.index] = true;
      return { h, v, ...claim(h, v, state.size, state.owner, 2) };
    };

    const pick = bestMove(state, options, apply, difficulty);
    const played = apply(pick);
    return {
      ...state,
      h: played.h,
      v: played.v,
      owner: played.owner,
      scores: { ...state.scores, bot: state.scores.bot + played.gained },
    };
  },
  status(state): EngineStatus {
    if (state.owner.some((o) => o === 0)) return "playing";
    if (state.scores.human > state.scores.bot) return "human_win";
    if (state.scores.bot > state.scores.human) return "bot_win";
    return "draw";
  },
};

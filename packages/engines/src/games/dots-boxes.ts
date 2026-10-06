import type { EngineStatus, GameEngine, MoveResult } from "@arcade/game-core";

type State = {
  kind: "boxes";
  size: number;
  h: boolean[];
  v: boolean[];
  owner: number[];
  scores: { human: number; bot: number };
};
type Move = { dir: "h" | "v"; index: number };

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
  rules: "Tap a missing line between the dots. When your line closes a square, it is yours. Most boxes on the 2×2 grid wins. The bot takes a box when it can.",
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
  applyBotMove(state) {
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

    const scoring = options.find((m) => apply(m).gained > 0);
    const pick = scoring ?? options[Math.floor(Math.random() * options.length)]!;
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

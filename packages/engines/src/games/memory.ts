import type { EngineStatus, GameEngine, MoveResult } from "@arcade/game-core";

type State = {
  kind: "memory";
  cols: number;
  cards: number[];
  matched: boolean[];
  /** Cards the bot has been shown, index → pair id */
  seen: Record<string, number>;
  scores: { human: number; bot: number };
};
type Move = { a: number; b: number };

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i]!;
    a[i] = a[j]!;
    a[j] = tmp;
  }
  return a;
}

export const memoryEngine: GameEngine<State, Move> = {
  id: "memory",
  name: "Memory",
  description: "4×4 pairs. Match two cards to score.",
  rules: "Tap two face-down cards. If they match, you keep the pair. If not, they hide again — but the bot remembers every card you revealed and will take a pair it has seen.",
  newState: () => ({
    kind: "memory",
    cols: 4,
    cards: shuffle([0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7]),
    matched: Array(16).fill(false),
    seen: {},
    scores: { human: 0, bot: 0 },
  }),
  applyHumanMove(state, move): MoveResult<State> {
    const { a, b } = move;
    if (
      !Number.isInteger(a) ||
      !Number.isInteger(b) ||
      a === b ||
      a < 0 ||
      b < 0 ||
      a > 15 ||
      b > 15 ||
      state.matched[a] ||
      state.matched[b]
    ) {
      return { state, illegal: true };
    }
    const matched = [...state.matched];
    const scores = { ...state.scores };
    const seen = { ...state.seen, [a]: state.cards[a]!, [b]: state.cards[b]! };
    if (state.cards[a] === state.cards[b]) {
      matched[a] = matched[b] = true;
      scores.human += 1;
    }
    return { state: { ...state, matched, scores, seen } };
  },
  applyBotMove(state) {
    if (state.scores.human + state.scores.bot >= 8) return state;
    const hidden = state.matched.map((m, i) => (m ? -1 : i)).filter((i) => i >= 0);
    if (hidden.length < 2) return state;

    const byId = new Map<number, number[]>();
    for (const i of hidden) {
      const id = state.seen[String(i)];
      if (id === undefined) continue;
      const list = byId.get(id) ?? [];
      list.push(i);
      byId.set(id, list);
    }
    let pair: [number, number] | null = null;
    for (const list of byId.values()) {
      if (list.length >= 2) {
        pair = [list[0]!, list[1]!];
        break;
      }
    }

    const a = pair?.[0] ?? hidden[Math.floor(Math.random() * hidden.length)]!;
    let b = pair?.[1] ?? hidden[Math.floor(Math.random() * hidden.length)]!;
    while (b === a) b = hidden[Math.floor(Math.random() * hidden.length)]!;

    const matched = [...state.matched];
    const scores = { ...state.scores };
    const seen = { ...state.seen, [a]: state.cards[a]!, [b]: state.cards[b]! };
    if (state.cards[a] === state.cards[b]) {
      matched[a] = matched[b] = true;
      scores.bot += 1;
    }
    return { ...state, matched, scores, seen };
  },
  status(state): EngineStatus {
    if (state.scores.human + state.scores.bot < 8) return "playing";
    if (state.scores.human > state.scores.bot) return "human_win";
    if (state.scores.bot > state.scores.human) return "bot_win";
    return "draw";
  },
};

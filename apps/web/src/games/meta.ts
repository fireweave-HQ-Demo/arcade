/** Lobby taxonomy and competitive cover themes for each game. */

export type GameCategory = "all" | "classics" | "gravity" | "strategy" | "puzzle" | "quick";

export const CATEGORIES: { id: GameCategory; label: string }[] = [
  { id: "all", label: "All games" },
  { id: "classics", label: "Classics" },
  { id: "gravity", label: "Gravity" },
  { id: "strategy", label: "Strategy" },
  { id: "puzzle", label: "Puzzle" },
  { id: "quick", label: "5-minute fun" },
];

export type CoverTheme = {
  from: string;
  to: string;
  accent: string;
  ink: string;
  pattern: "grid" | "dots" | "stripes" | "rings" | "diag" | "waves";
  tags: GameCategory[];
  blurb: string;
};

/** Saturated arena covers — volt / cyan / cobalt / amber / KO red. */
export const GAME_META: Record<string, CoverTheme> = {
  tictactoe: {
    from: "#0b1220",
    to: "#c8ff2e",
    accent: "#ffffff",
    ink: "#061018",
    pattern: "grid",
    tags: ["classics", "quick"],
    blurb: "Three in a row. Instant classic.",
  },
  connectfour: {
    from: "#0a1f6e",
    to: "#00d4ff",
    accent: "#ff2d55",
    ink: "#040b28",
    pattern: "dots",
    tags: ["classics", "gravity"],
    blurb: "Drop discs. Connect four.",
  },
  connectthree: {
    from: "#063a36",
    to: "#00e5a8",
    accent: "#ffb020",
    ink: "#021814",
    pattern: "dots",
    tags: ["gravity", "quick"],
    blurb: "Wider board. Shorter streak.",
  },
  gomoku: {
    from: "#101828",
    to: "#2f6bff",
    accent: "#c8ff2e",
    ink: "#070b14",
    pattern: "grid",
    tags: ["strategy"],
    blurb: "Five in a row on a big grid.",
  },
  miserettt: {
    from: "#4a0a18",
    to: "#ff2d55",
    accent: "#ffb020",
    ink: "#1a0408",
    pattern: "diag",
    tags: ["quick", "puzzle"],
    blurb: "Make three and you lose.",
  },
  wildttt: {
    from: "#053028",
    to: "#00d4ff",
    accent: "#c8ff2e",
    ink: "#021410",
    pattern: "diag",
    tags: ["quick", "puzzle"],
    blurb: "Pick X or O every turn.",
  },
  sos: {
    from: "#0a3048",
    to: "#00d4ff",
    accent: "#ffb020",
    ink: "#041018",
    pattern: "waves",
    tags: ["puzzle", "strategy"],
    blurb: "Spell SOS. Score points.",
  },
  popout: {
    from: "#0c2448",
    to: "#2f6bff",
    accent: "#ffb020",
    ink: "#040c1c",
    pattern: "dots",
    tags: ["gravity", "quick"],
    blurb: "Connect three with gravity.",
  },
  powerfour: {
    from: "#3a0a20",
    to: "#ff2d55",
    accent: "#c8ff2e",
    ink: "#14040c",
    pattern: "rings",
    tags: ["gravity", "strategy"],
    blurb: "Tighter board. Connect four.",
  },
  nim: {
    from: "#121820",
    to: "#2f6bff",
    accent: "#00d4ff",
    ink: "#06080c",
    pattern: "stripes",
    tags: ["strategy", "quick"],
    blurb: "Take objects. Leave zero.",
  },
  subtractsquare: {
    from: "#2a1c08",
    to: "#ffb020",
    accent: "#00d4ff",
    ink: "#120c04",
    pattern: "diag",
    tags: ["puzzle", "quick"],
    blurb: "Subtract a square number.",
  },
  reversi: {
    from: "#061820",
    to: "#00b8a0",
    accent: "#f4f7ff",
    ink: "#020c10",
    pattern: "rings",
    tags: ["classics", "strategy"],
    blurb: "Flip discs. Own the board.",
  },
  hexapawn: {
    from: "#2a1008",
    to: "#ff6a00",
    accent: "#ffb020",
    ink: "#140804",
    pattern: "stripes",
    tags: ["strategy"],
    blurb: "Tiny chess with only pawns.",
  },
  mancala: {
    from: "#0a2830",
    to: "#00b8a0",
    accent: "#ffb020",
    ink: "#041014",
    pattern: "waves",
    tags: ["strategy", "classics"],
    blurb: "Sow seeds. Capture pits.",
  },
  memory: {
    from: "#101828",
    to: "#5a7cff",
    accent: "#c8ff2e",
    ink: "#080c14",
    pattern: "dots",
    tags: ["classics", "puzzle", "quick"],
    blurb: "Flip cards. Match pairs.",
  },
  orderchaos: {
    from: "#0c1428",
    to: "#2f6bff",
    accent: "#e8eeff",
    ink: "#060a14",
    pattern: "grid",
    tags: ["strategy", "puzzle"],
    blurb: "Order builds. Chaos blocks.",
  },
  dotsboxes: {
    from: "#102018",
    to: "#00b8a0",
    accent: "#c8ff2e",
    ink: "#06100c",
    pattern: "grid",
    tags: ["puzzle", "classics"],
    blurb: "Claim lines. Own the boxes.",
  },
};

export function metaFor(id: string): CoverTheme {
  return (
    GAME_META[id] ?? {
      from: "#0b1220",
      to: "#c8ff2e",
      accent: "#ffffff",
      ink: "#061018",
      pattern: "grid",
      tags: ["quick"],
      blurb: "Play vs the arcade bot.",
    }
  );
}

export function inCategory(id: string, cat: GameCategory): boolean {
  if (cat === "all") return true;
  return metaFor(id).tags.includes(cat);
}

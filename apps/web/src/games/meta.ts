/** Lobby taxonomy and cover themes for each game. */

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

export const GAME_META: Record<string, CoverTheme> = {
  tictactoe: {
    from: "#1f6f5b",
    to: "#7dffa2",
    accent: "#f3e7c9",
    ink: "#0d1a15",
    pattern: "grid",
    tags: ["classics", "quick"],
    blurb: "Three in a row. Instant classic.",
  },
  connectfour: {
    from: "#0b3d91",
    to: "#5bb8ff",
    accent: "#ff5a5f",
    ink: "#061428",
    pattern: "dots",
    tags: ["classics", "gravity"],
    blurb: "Drop discs. Connect four.",
  },
  connectthree: {
    from: "#2a5a3a",
    to: "#9dffb0",
    accent: "#ffe08a",
    ink: "#0d1a12",
    pattern: "dots",
    tags: ["gravity", "quick"],
    blurb: "Wider board. Shorter streak.",
  },
  gomoku: {
    from: "#1a1a2e",
    to: "#4a6fa5",
    accent: "#e8d5b7",
    ink: "#0a0a14",
    pattern: "grid",
    tags: ["strategy"],
    blurb: "Five in a row on a big grid.",
  },
  miserettt: {
    from: "#5c2a2a",
    to: "#ff8a7a",
    accent: "#ffe3a3",
    ink: "#1a0c0c",
    pattern: "diag",
    tags: ["quick", "puzzle"],
    blurb: "Make three and you lose.",
  },
  wildttt: {
    from: "#0f5c4c",
    to: "#3dd6c6",
    accent: "#ffe08a",
    ink: "#06201a",
    pattern: "diag",
    tags: ["quick", "puzzle"],
    blurb: "Pick X or O every turn.",
  },
  sos: {
    from: "#0f4c5c",
    to: "#5ad1e0",
    accent: "#ffd166",
    ink: "#06161a",
    pattern: "waves",
    tags: ["puzzle", "strategy"],
    blurb: "Spell SOS. Score points.",
  },
  popout: {
    from: "#16324f",
    to: "#6ec6ff",
    accent: "#ff9f1c",
    ink: "#071018",
    pattern: "dots",
    tags: ["gravity", "quick"],
    blurb: "Connect three with gravity.",
  },
  powerfour: {
    from: "#3b1f2b",
    to: "#ff6b6b",
    accent: "#ffe66d",
    ink: "#140a10",
    pattern: "rings",
    tags: ["gravity", "strategy"],
    blurb: "Tighter board. Connect four.",
  },
  nim: {
    from: "#2d3436",
    to: "#74b9ff",
    accent: "#55efc4",
    ink: "#0e1214",
    pattern: "stripes",
    tags: ["strategy", "quick"],
    blurb: "Take objects. Leave zero.",
  },
  subtractsquare: {
    from: "#4a3728",
    to: "#e9c46a",
    accent: "#2a9d8f",
    ink: "#1a120c",
    pattern: "diag",
    tags: ["puzzle", "quick"],
    blurb: "Subtract a square number.",
  },
  reversi: {
    from: "#0d2818",
    to: "#2d6a4f",
    accent: "#f8f9fa",
    ink: "#06140c",
    pattern: "rings",
    tags: ["classics", "strategy"],
    blurb: "Flip discs. Own the board.",
  },
  hexapawn: {
    from: "#3c1518",
    to: "#c44900",
    accent: "#f4d35e",
    ink: "#160808",
    pattern: "stripes",
    tags: ["strategy"],
    blurb: "Tiny chess with only pawns.",
  },
  mancala: {
    from: "#264653",
    to: "#2a9d8f",
    accent: "#e9c46a",
    ink: "#0c1618",
    pattern: "waves",
    tags: ["strategy", "classics"],
    blurb: "Sow seeds. Capture pits.",
  },
  memory: {
    from: "#22223b",
    to: "#9a8c98",
    accent: "#f2e9e4",
    ink: "#0e0e18",
    pattern: "dots",
    tags: ["classics", "puzzle", "quick"],
    blurb: "Flip cards. Match pairs.",
  },
  orderchaos: {
    from: "#1b263b",
    to: "#415a77",
    accent: "#e0e1dd",
    ink: "#0a1018",
    pattern: "grid",
    tags: ["strategy", "puzzle"],
    blurb: "Order builds. Chaos blocks.",
  },
  dotsboxes: {
    from: "#283618",
    to: "#606c38",
    accent: "#fefae0",
    ink: "#101608",
    pattern: "grid",
    tags: ["puzzle", "classics"],
    blurb: "Claim lines. Own the boxes.",
  },
};

export function metaFor(id: string): CoverTheme {
  return (
    GAME_META[id] ?? {
      from: "#1f6f5b",
      to: "#7dffa2",
      accent: "#f3e7c9",
      ink: "#0d1a15",
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

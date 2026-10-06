/** Arcade mark and per-game glyphs. */

export function ArcadeMark({ className = "" }: { className?: string }) {
  return (
    <svg className={`mark ${className}`} viewBox="0 0 48 48" aria-hidden="true">
      <rect x="2" y="2" width="44" height="44" rx="12" className="mark-bg" />
      <circle cx="17" cy="18" r="6" className="mark-a" />
      <circle cx="31" cy="18" r="6" className="mark-b" />
      <path d="M14 32h20" className="mark-line" />
      <path d="M18 32c1.2 4 10.8 4 12 0" className="mark-smile" />
    </svg>
  );
}

const GLYPHS: Record<string, { label: string; paths: string }> = {
  tictactoe: { label: "grid", paths: "M8 16h32M8 32h32M16 8v32M32 8v32" },
  connectfour: { label: "drop", paths: "M10 14h28M16 14v6a8 8 0 1 0 16 0v-6M24 30v8" },
  connectthree: { label: "three", paths: "M10 24h28M24 10v28M14 14l20 20" },
  gomoku: { label: "five", paths: "M8 12h32M8 20h32M8 28h32M8 36h32M12 8v32M20 8v32M28 8v32M36 8v32" },
  miserettt: { label: "misere", paths: "M8 16h32M8 32h32M16 8v32M32 8v32M14 14l20 20" },
  wildttt: { label: "wild", paths: "M16 14l8 20M32 14l-8 20M14 28h20" },
  sos: { label: "sos", paths: "M12 16c6-8 12 8 18 0M12 32c6-8 12 8 18 0" },
  popout: { label: "drop three", paths: "M12 12h24M16 12v8a8 8 0 1 0 16 0v-8" },
  powerfour: { label: "power", paths: "M24 8l4 12h12l-10 8 4 12-10-7-10 7 4-12-10-8h12z" },
  nim: { label: "heaps", paths: "M12 36V22M24 36V14M36 36V26" },
  subtractsquare: { label: "squares", paths: "M10 10h12v12H10zM26 18h12v12H26zM16 26h10v10H16z" },
  reversi: { label: "reversi", paths: "M24 8a16 16 0 1 0 0 32 16 16 0 0 0 0-32zM24 8a16 16 0 0 1 0 32z" },
  hexapawn: { label: "pawns", paths: "M16 36V22M24 36V16M32 36V22M16 20a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM24 14a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM32 20a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" },
  mancala: { label: "pits", paths: "M8 24h32M14 24a4 4 0 1 0 0.1 0M24 24a4 4 0 1 0 0.1 0M34 24a4 4 0 1 0 0.1 0" },
  memory: { label: "pairs", paths: "M12 12h10v14H12zM26 22h10v14H26z" },
  orderchaos: { label: "order", paths: "M10 34L24 10l14 24M16 26h16" },
  dotsboxes: { label: "boxes", paths: "M14 14h20v20H14zM14 14v20M34 14v20M14 24h20M24 14v20" },
};

export function GameMark({ id }: { id: string }) {
  const glyph = GLYPHS[id] ?? { label: id, paths: "M12 24h24M24 12v24" };
  return (
    <svg className="game-mark" viewBox="0 0 48 48" role="img" aria-label={glyph.label}>
      <rect x="1" y="1" width="46" height="46" rx="12" className="game-mark-bg" />
      <path d={glyph.paths} className="game-mark-stroke" />
    </svg>
  );
}

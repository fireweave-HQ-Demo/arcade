import { metaFor } from "./meta";

/** Dense cover motifs — filled shapes read better as thumbnails. */
function Motif({ id, accent, ink }: { id: string; accent: string; ink: string }) {
  switch (id) {
    case "tictactoe":
      return (
        <g>
          <rect x="10" y="10" width="44" height="44" rx="6" fill={ink} opacity="0.28" />
          <path d="M25 14v36M39 14v36M14 25h36M14 39h36" stroke={accent} strokeWidth="3.2" />
          <circle cx="18" cy="18" r="4" fill={accent} />
          <path d="M42 42l6 6M48 42l-6 6" stroke={accent} strokeWidth="2.8" strokeLinecap="round" />
        </g>
      );
    case "connectfour":
      return (
        <g>
          {[0, 1, 2, 3].map((c) =>
            [0, 1, 2, 3, 4].map((r) => (
              <circle
                key={`${c}-${r}`}
                cx={16 + c * 11}
                cy={14 + r * 9}
                r="3.6"
                fill={r + c > 4 ? accent : ink}
                opacity={r + c > 4 ? 0.95 : 0.35}
              />
            )),
          )}
        </g>
      );
    case "connectthree":
      return (
        <g>
          {[0, 1, 2, 3, 4].map((c) =>
            [0, 1, 2].map((r) => (
              <circle
                key={`${c}-${r}`}
                cx={12 + c * 10}
                cy={20 + r * 12}
                r="4"
                fill={(c === 1 || c === 2 || c === 3) && r === 1 ? accent : ink}
                opacity={(c === 1 || c === 2 || c === 3) && r === 1 ? 1 : 0.3}
              />
            )),
          )}
        </g>
      );
    case "gomoku":
      return (
        <g stroke={accent} strokeWidth="1.4" opacity="0.85">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <line key={`h${i}`} x1="12" y1={14 + i * 7} x2="52" y2={14 + i * 7} />
          ))}
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <line key={`v${i}`} x1={14 + i * 7} y1="12" x2={14 + i * 7} y2="52" />
          ))}
          <circle cx="32" cy="32" r="3.5" fill={accent} stroke="none" />
          <circle cx="25" cy="32" r="2.5" fill={ink} stroke="none" opacity="0.7" />
          <circle cx="39" cy="32" r="2.5" fill={ink} stroke="none" opacity="0.7" />
        </g>
      );
    case "miserettt":
      return (
        <g>
          <path d="M22 14v36M42 14v36M14 22h36M14 42h36" stroke={accent} strokeWidth="3" opacity="0.55" />
          <path d="M18 18l28 28M46 18L18 46" stroke={accent} strokeWidth="4" strokeLinecap="round" />
        </g>
      );
    case "wildttt":
      return (
        <g>
          <text x="18" y="40" fill={accent} fontSize="22" fontWeight="800" fontFamily="Syne, sans-serif">
            X
          </text>
          <text x="36" y="48" fill={ink} opacity="0.55" fontSize="18" fontWeight="800" fontFamily="Syne, sans-serif">
            O
          </text>
        </g>
      );
    case "sos":
      return (
        <g fill={accent} fontFamily="Syne, sans-serif" fontWeight="800" fontSize="16">
          <text x="10" y="28">
            S
          </text>
          <text x="26" y="40">
            O
          </text>
          <text x="42" y="52">
            S
          </text>
        </g>
      );
    case "popout":
      return (
        <g>
          {[0, 1, 2].map((c) => (
            <g key={c}>
              <rect x={14 + c * 14} y="12" width="10" height="40" rx="5" fill={ink} opacity="0.28" />
              <circle cx={19 + c * 14} cy={20 + c * 8} r="4.5" fill={accent} />
            </g>
          ))}
        </g>
      );
    case "powerfour":
      return (
        <g>
          <path
            d="M32 10l5 14h15l-12 9 5 15-13-9-13 9 5-15-12-9h15z"
            fill={accent}
            opacity="0.95"
          />
        </g>
      );
    case "nim":
      return (
        <g stroke={accent} strokeWidth="5" strokeLinecap="round">
          <line x1="18" y1="50" x2="18" y2="28" />
          <line x1="32" y1="50" x2="32" y2="14" />
          <line x1="46" y1="50" x2="46" y2="34" />
        </g>
      );
    case "subtractsquare":
      return (
        <g fill={accent}>
          <rect x="12" y="12" width="18" height="18" rx="3" opacity="0.95" />
          <rect x="34" y="22" width="18" height="18" rx="3" opacity="0.7" />
          <rect x="22" y="36" width="14" height="14" rx="3" opacity="0.5" />
        </g>
      );
    case "reversi":
      return (
        <g>
          <circle cx="32" cy="32" r="20" fill={ink} opacity="0.35" />
          <path d="M32 12a20 20 0 0 1 0 40z" fill={accent} />
          <circle cx="32" cy="32" r="20" fill="none" stroke={accent} strokeWidth="2" />
        </g>
      );
    case "hexapawn":
      return (
        <g fill={accent}>
          {[16, 32, 48].map((x, i) => (
            <g key={x} opacity={1 - i * 0.15}>
              <circle cx={x} cy={22 + (i === 1 ? -4 : 0)} r="5" />
              <path d={`M${x - 7} ${48} Q${x} ${30} ${x + 7} 48Z`} />
            </g>
          ))}
        </g>
      );
    case "mancala":
      return (
        <g>
          <ellipse cx="32" cy="32" rx="26" ry="16" fill={ink} opacity="0.3" />
          {[14, 24, 34, 44, 50].map((x, i) => (
            <circle key={x} cx={x} cy={30 + (i % 2)} r="4" fill={accent} opacity={0.55 + i * 0.08} />
          ))}
        </g>
      );
    case "memory":
      return (
        <g>
          <rect x="12" y="14" width="18" height="24" rx="4" fill={accent} />
          <rect x="34" y="26" width="18" height="24" rx="4" fill={ink} opacity="0.45" />
          <rect x="34" y="26" width="18" height="24" rx="4" fill="none" stroke={accent} strokeWidth="2" />
        </g>
      );
    case "orderchaos":
      return (
        <g>
          <path d="M12 48 L32 14 L52 48Z" fill="none" stroke={accent} strokeWidth="3" />
          <circle cx="32" cy="36" r="5" fill={accent} />
          <path d="M20 48h24" stroke={ink} strokeWidth="3" opacity="0.4" />
        </g>
      );
    case "dotsboxes":
      return (
        <g>
          {[0, 1, 2].map((r) =>
            [0, 1, 2].map((c) => (
              <circle key={`${r}-${c}`} cx={18 + c * 14} cy={18 + r * 14} r="2.8" fill={accent} />
            )),
          )}
          <path
            d="M18 18h14v14H18zM32 32h14v14H32z"
            fill={accent}
            opacity="0.35"
            stroke={accent}
            strokeWidth="2"
          />
        </g>
      );
    default:
      return (
        <g>
          <circle cx="32" cy="32" r="16" fill={accent} opacity="0.85" />
        </g>
      );
  }
}

function Pattern({ kind, accent }: { kind: string; accent: string }) {
  if (kind === "dots") {
    return (
      <g fill={accent} opacity="0.16">
        {Array.from({ length: 24 }, (_, i) => (
          <circle key={i} cx={8 + (i % 6) * 11} cy={8 + Math.floor(i / 6) * 14} r="2" />
        ))}
      </g>
    );
  }
  if (kind === "stripes") {
    return (
      <g stroke={accent} strokeWidth="3" opacity="0.12">
        {Array.from({ length: 8 }, (_, i) => (
          <line key={i} x1={i * 12} y1="0" x2={i * 12 + 40} y2="64" />
        ))}
      </g>
    );
  }
  if (kind === "rings") {
    return (
      <g fill="none" stroke={accent} strokeWidth="2" opacity="0.2">
        <circle cx="50" cy="16" r="16" />
        <circle cx="14" cy="50" r="12" />
      </g>
    );
  }
  if (kind === "waves") {
    return (
      <g fill="none" stroke={accent} strokeWidth="2" opacity="0.2">
        <path d="M0 22c10 8 18-8 28 0s18-8 28 0 18-8 28 0" />
        <path d="M0 40c10 8 18-8 28 0s18-8 28 0 18-8 28 0" />
      </g>
    );
  }
  if (kind === "diag") {
    return (
      <g stroke={accent} strokeWidth="2" opacity="0.14">
        {Array.from({ length: 10 }, (_, i) => (
          <line key={i} x1={-20 + i * 14} y1="64" x2={20 + i * 14} y2="0" />
        ))}
      </g>
    );
  }
  return (
    <g stroke={accent} strokeWidth="1.4" opacity="0.14">
      {Array.from({ length: 5 }, (_, i) => (
        <line key={`h${i}`} x1="0" y1={10 + i * 12} x2="64" y2={10 + i * 12} />
      ))}
      {Array.from({ length: 5 }, (_, i) => (
        <line key={`v${i}`} x1={10 + i * 12} y1="0" x2={10 + i * 12} y2="64" />
      ))}
    </g>
  );
}

export function GameCover({ id }: { id: string; title?: string }) {
  const theme = metaFor(id);
  return (
    <svg className="game-cover-art" viewBox="0 0 64 64" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <linearGradient id={`cg-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={theme.from} />
          <stop offset="100%" stopColor={theme.to} />
        </linearGradient>
      </defs>
      <rect width="64" height="64" fill={`url(#cg-${id})`} />
      <Pattern kind={theme.pattern} accent={theme.accent} />
      <Motif id={id} accent={theme.accent} ink={theme.ink} />
    </svg>
  );
}

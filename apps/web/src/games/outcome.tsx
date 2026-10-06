import type { CSSProperties } from "react";

const BITS = 14;

/** Per-game win / loss overlay. Each id has its own motion in outcome.css. */
export function OutcomeFX({
  gameId,
  result,
}: {
  gameId: string;
  result: "win" | "lose" | "";
}) {
  if (!result) return null;
  return (
    <div className={`outcome outcome-${result}`} data-game={gameId} aria-hidden>
      {Array.from({ length: BITS }, (_, i) => (
        <span key={i} style={{ "--i": i } as CSSProperties} />
      ))}
    </div>
  );
}

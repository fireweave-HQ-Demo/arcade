import type { BotDifficulty } from "@arcade/game-core";

/** Search depth. `mid` and an omitted level stay on the engine's current depth. */
export function depthFor(base: number, level: BotDifficulty | undefined, cap: number): number {
  if (!level || level === "mid") return base;
  if (level === "easy") return 1;
  if (level === "hard") return Math.min(cap, base + 2);
  return Math.min(cap, base + 3);
}

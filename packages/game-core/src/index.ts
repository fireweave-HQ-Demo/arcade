import type { MatchResult } from "@arcade/shared";

export type EngineStatus = "playing" | Exclude<MatchResult, null>;

/** Omitted or `mid` keeps the bot that already ships. */
export type BotDifficulty = "easy" | "mid" | "hard" | "nightmare";

export type MoveResult<TState> = {
  state: TState;
  illegal?: boolean;
};

/** Port implemented by every game package. */
export interface GameEngine<TState = unknown, TMove = unknown> {
  id: string;
  name: string;
  /** One-line lobby summary */
  description: string;
  /** How to play, shown on the board */
  rules: string;
  newState(): TState;
  applyHumanMove(state: TState, move: TMove): MoveResult<TState>;
  applyBotMove(state: TState, difficulty?: BotDifficulty): TState;
  status(state: TState): EngineStatus;
}

export class EngineRegistry {
  private readonly engines = new Map<string, GameEngine>();

  register(engine: GameEngine) {
    this.engines.set(engine.id, engine);
  }

  get(id: string): GameEngine | undefined {
    return this.engines.get(id);
  }

  require(id: string): GameEngine {
    const engine = this.get(id);
    if (!engine) throw new Error(`Unknown game: ${id}`);
    return engine;
  }

  list(): GameEngine[] {
    return [...this.engines.values()];
  }
}

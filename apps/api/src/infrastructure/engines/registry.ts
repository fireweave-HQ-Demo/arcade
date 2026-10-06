import type { EngineCatalog } from "../../domain/ports";
import { EngineRegistry } from "@arcade/game-core";
import { ticTacToeEngine } from "@arcade/engine-tictactoe";
import { connectFourEngine } from "@arcade/engine-connectfour";
import { suiteEngines } from "@arcade/engine-suite";

export function createEngineCatalog(): EngineCatalog {
  const registry = new EngineRegistry();
  registry.register(ticTacToeEngine);
  registry.register(connectFourEngine);
  for (const engine of suiteEngines) registry.register(engine);
  return registry;
}

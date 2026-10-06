import { EngineRegistry } from "@arcade/game-core";
import { ticTacToeEngine } from "@arcade/engine-tictactoe";
import { connectFourEngine } from "@arcade/engine-connectfour";
import { rpsEngine } from "@arcade/engine-rps";
import type { EngineCatalog } from "../../domain/ports";

export function createEngineCatalog(): EngineCatalog {
  const registry = new EngineRegistry();
  registry.register(ticTacToeEngine);
  registry.register(connectFourEngine);
  registry.register(rpsEngine);
  return registry;
}

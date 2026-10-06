import type { EngineCatalog } from "../../domain/ports";
import { EngineRegistry } from "@arcade/game-core";
import { engines } from "@arcade/engines";

export function createEngineCatalog(): EngineCatalog {
  const registry = new EngineRegistry();
  for (const engine of engines) registry.register(engine);
  return registry;
}

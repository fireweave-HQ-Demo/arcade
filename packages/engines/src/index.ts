import type { GameEngine } from "@arcade/game-core";
import { ticTacToeEngine } from "./games/tictactoe";
import { connectFourEngine } from "./games/connectfour";
import { connectThreeEngine, gomokuEngine, misereTttEngine } from "./games/placement";
import { orderChaosEngine, sosEngine, wildTttEngine } from "./games/marks";
import { popOutEngine, powerFourEngine } from "./games/drops";
import { nimEngine } from "./games/nim";
import { subtractSquareEngine } from "./games/subtract-square";
import { reversiEngine } from "./games/reversi";
import { hexapawnEngine } from "./games/hexapawn";
import { mancalaEngine } from "./games/mancala";
import { memoryEngine } from "./games/memory";
import { dotsBoxesEngine } from "./games/dots-boxes";

/** Stable lobby order. */
export const engines: GameEngine[] = [
  ticTacToeEngine,
  connectFourEngine,
  connectThreeEngine,
  gomokuEngine,
  misereTttEngine,
  wildTttEngine,
  sosEngine,
  popOutEngine,
  powerFourEngine,
  nimEngine,
  subtractSquareEngine,
  reversiEngine,
  hexapawnEngine,
  mancalaEngine,
  memoryEngine,
  orderChaosEngine,
  dotsBoxesEngine,
];

import { dropEngine } from "../lib/drop";

export const popOutEngine = dropEngine({
  id: "popout",
  name: "Drop Three",
  description: "Smaller gravity board. Three in a row wins.",
  rules: "Tap a column. Your disc falls to the bottom. Connect three in any direction. (This is a drop game — discs are not popped back out.)",
  rows: 5,
  cols: 6,
  need: 3,
});

export const powerFourEngine = dropEngine({
  id: "powerfour",
  name: "Power Four",
  description: "Tight 5×5 gravity board. Four in a row wins.",
  rules: "Tap a column to drop a disc. Four in a row, column, or diagonal wins. The board is smaller than classic Connect Four, so columns fill fast.",
  rows: 5,
  cols: 5,
  need: 4,
});

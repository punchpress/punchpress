import { EMPTY_APPEARANCE } from "./appearance-layers";
import type { Appearance } from "./appearance-types";

// Paint nodes (text, shape, path) own an appearance stack; every other node
// paints nothing of its own.
export const getNodeAppearance = (node): Appearance => {
  return node?.appearance ?? EMPTY_APPEARANCE;
};

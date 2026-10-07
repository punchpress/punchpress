import { upgradeNodeAppearance1_8 } from "@punchpress/punch-schema";
import type { Appearance } from "./appearance-types";

const EMPTY_APPEARANCE: Appearance = Object.freeze({
  fills: Object.freeze([]),
  strokes: Object.freeze([]),
}) as Appearance;

const derivedAppearanceByNode = new WeakMap<object, Appearance>();

// Returns the node's appearance stack. Nodes still carrying 1.8 flat paint
// fields (until the 1.9 schema cutover) derive an equivalent stack once per
// immutable node object, so plan caches keyed on appearance identity hold.
export const getNodeAppearance = (node): Appearance => {
  if (!node || typeof node !== "object") {
    return EMPTY_APPEARANCE;
  }

  if (node.appearance) {
    return node.appearance;
  }

  const cached = derivedAppearanceByNode.get(node);

  if (cached) {
    return cached;
  }

  const upgraded = upgradeNodeAppearance1_8(node) as {
    appearance?: Appearance;
  };
  const appearance = upgraded.appearance ?? EMPTY_APPEARANCE;

  derivedAppearanceByNode.set(node, appearance);

  return appearance;
};

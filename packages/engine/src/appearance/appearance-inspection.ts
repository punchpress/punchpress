import { getAppearanceTargetNodeIds } from "./appearance-commands";
import type { StrokeLayer } from "./appearance-types";
import { getNodeAppearance } from "./node-appearance";

interface PrimaryStrokeStyle {
  cap: StrokeLayer["cap"] | null;
  isCapMixed: boolean;
  isJoinMixed: boolean;
  join: StrokeLayer["join"] | null;
}

// Cap and join of the primary (first) stroke layer across every paint target,
// each aggregated on its own. Null when any target has no stroke, since a cap
// or join edit would have nothing to apply to there.
export const getPrimaryStrokeStyle = (
  editor,
  nodeIds: string[]
): PrimaryStrokeStyle | null => {
  const strokes = getAppearanceTargetNodeIds(editor, nodeIds).map((nodeId) => {
    return getNodeAppearance(editor.getNode(nodeId)).strokes[0] ?? null;
  });

  if (strokes.length === 0 || strokes.some((stroke) => !stroke)) {
    return null;
  }

  const [first] = strokes as StrokeLayer[];
  const isCapMixed = strokes.some((stroke) => stroke?.cap !== first.cap);
  const isJoinMixed = strokes.some((stroke) => stroke?.join !== first.join);

  return {
    cap: isCapMixed ? null : first.cap,
    isCapMixed,
    isJoinMixed,
    join: isJoinMixed ? null : first.join,
  };
};

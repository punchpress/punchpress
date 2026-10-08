import { getSelectionProperty } from "../inspection/selection-inspection";
import {
  type AppearanceList,
  type AppearanceSlot,
  getAppearanceTargetNodeIds,
} from "./appearance-commands";
import { canAlignPaths } from "./appearance-render-plan";
import type { Appearance, FillLayer, StrokeLayer } from "./appearance-types";
import { getNodeAppearance } from "./node-appearance";
import { getRenderedAppearancePaths } from "./rendered-appearance";

interface PrimaryStrokeStyle {
  cap: StrokeLayer["cap"] | null;
  isCapMixed: boolean;
  isJoinMixed: boolean;
  join: StrokeLayer["join"] | null;
}

interface SelectionAppearance {
  // The shared stack (the first target's stored stack), or the first target's
  // stack when stacks differ.
  appearance: Appearance | null;
  isMixed: boolean;
}

// The stack the inspector shows. Multi-selections share a stack only when
// every stack is equal apart from layer ids; otherwise the selection reads as
// mixed and `appearance` is the stack "use first" copies. Null when the
// selection has no appearance property.
export const getSelectionAppearance = (
  editor,
  nodeIds: string[]
): SelectionAppearance | null => {
  const property = getSelectionProperty(editor, "appearance", nodeIds);

  if (!property) {
    return null;
  }

  if (!property.isMixed) {
    return { appearance: property.value as Appearance, isMixed: false };
  }

  const [firstNodeId] = getAppearanceTargetNodeIds(editor, nodeIds);

  return {
    appearance: firstNodeId
      ? getNodeAppearance(editor.getNode(firstNodeId))
      : null,
    isMixed: true,
  };
};

// Layer ids of one list of the shared stack, in stored (bottom-to-top) order.
// Empty when the selection is mixed or has no stack.
export const getAppearanceLayerIds = (
  editor,
  list: AppearanceList,
  nodeIds: string[]
): string[] => {
  const layers = getSharedLayers(editor, list, nodeIds);

  return layers ? layers.map((layer) => layer.id) : [];
};

// Resolves a row's layer id to its layer and current slot in the shared
// stack. Commands address layers by index across every target (ids differ
// between equal stacks), so controls resolve the slot when they dispatch.
export const getAppearanceLayer = (
  editor,
  list: AppearanceList,
  layerId: string,
  nodeIds: string[]
): { layer: FillLayer | StrokeLayer; slot: AppearanceSlot } | null => {
  const layers = getSharedLayers(editor, list, nodeIds);
  const index = layers ? layers.findIndex((layer) => layer.id === layerId) : -1;

  return layers && index >= 0
    ? { layer: layers[index], slot: { index, list } }
    : null;
};

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

// Whether every paint target renders where inside and outside strokes can
// align (the renderer's own rule); open-only paths stroke on center. Reads the
// rendered paths only, so it stays cheap while a stroke scrub changes the
// geometry every frame.
export const canAlignStrokes = (editor, nodeIds: string[]) => {
  return getAppearanceTargetNodeIds(editor, nodeIds).every((nodeId) => {
    const paths = getRenderedAppearancePaths(editor, nodeId);

    return !paths || canAlignPaths(paths);
  });
};

const getSharedLayers = (
  editor,
  list: AppearanceList,
  nodeIds: string[]
): readonly (FillLayer | StrokeLayer)[] | null => {
  const selection = getSelectionAppearance(editor, nodeIds);

  return selection?.appearance && !selection.isMixed
    ? selection.appearance[list]
    : null;
};

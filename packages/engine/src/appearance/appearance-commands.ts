import {
  appearanceSchema,
  MAX_APPEARANCE_LAYERS,
  parseColor,
} from "@punchpress/punch-schema";
import {
  getVectorAggregatePropertyNodes,
  isVectorAggregatePropertySelection,
} from "../inspection/selection-properties";
import { supportsNodeProperty } from "../nodes/node-property-support";
import {
  createLayerId,
  createSolidFill,
  createSolidStroke,
} from "./appearance-layers";
import type { Appearance, FillLayer, StrokeLayer } from "./appearance-types";
import { getNodeAppearance } from "./node-appearance";

export type AppearanceList = "fills" | "strokes";

export interface AppearanceSlot {
  index: number;
  list: AppearanceList;
}

type LayerPatch = Partial<Omit<StrokeLayer, "id" | "paint">> & {
  // A CSS color for a solid paint. Its alpha is ignored: layer opacity is
  // patched separately through `opacity`.
  color?: string;
};

const MAX_STROKE_WIDTH = 1000;

// Paint commands target the nodes that own stacks: a selected vector routes to
// its child paths, and path editing routes to the edited path.
export const getAppearanceTargetNodeIds = (editor, nodeIds) => {
  const targetNodeIds: string[] = nodeIds.flatMap((nodeId) => {
    if (isVectorAggregatePropertySelection(editor, nodeId)) {
      return getVectorAggregatePropertyNodes(editor, nodeId).map((node) => {
        return node.id;
      });
    }

    const targetNodeId = editor.getPathEditingTargetNodeId(nodeId) || nodeId;
    const targetNode = editor.getNode(targetNodeId);

    if (targetNode?.type === "vector") {
      return getVectorAggregatePropertyNodes(editor, targetNodeId).map(
        (node) => node.id
      );
    }

    return [targetNodeId];
  });

  return [...new Set(targetNodeIds)].filter((nodeId) => {
    return supportsNodeProperty(editor.getNode(nodeId), "appearance");
  });
};

export const addFill = (editor, nodeIds = editor.selectedNodeIds) => {
  return updateAppearances(editor, nodeIds, (appearance) => {
    if (appearance.fills.length >= MAX_APPEARANCE_LAYERS) {
      return null;
    }

    const topFill = appearance.fills.at(-1);
    const layer = createSolidFill(
      topFill?.paint.color ?? "#000000",
      createLayerId(appearance, "fill")
    );

    return layer
      ? { ...appearance, fills: [...appearance.fills, layer] }
      : null;
  });
};

export const addStroke = (editor, nodeIds = editor.selectedNodeIds) => {
  return updateAppearances(editor, nodeIds, (appearance) => {
    if (appearance.strokes.length >= MAX_APPEARANCE_LAYERS) {
      return null;
    }

    const layer = createSolidStroke("#000000", 2, {
      id: createLayerId(appearance, "stroke"),
    });

    return layer
      ? { ...appearance, strokes: [...appearance.strokes, layer] }
      : null;
  });
};

export const updateAppearanceLayer = (
  editor,
  slot: AppearanceSlot,
  patch: LayerPatch,
  nodeIds = editor.selectedNodeIds
) => {
  return updateAppearances(editor, nodeIds, (appearance) => {
    const layer = isIndex(slot.index, appearance[slot.list].length)
      ? appearance[slot.list][slot.index]
      : null;

    if (!layer) {
      return null;
    }

    const nextLayer = applyLayerPatch(slot.list, layer, patch);

    return nextLayer
      ? {
          ...appearance,
          [slot.list]: appearance[slot.list].map((current, index) => {
            return index === slot.index ? nextLayer : current;
          }),
        }
      : null;
  });
};

export const removeAppearanceLayer = (
  editor,
  slot: AppearanceSlot,
  nodeIds = editor.selectedNodeIds
) => {
  return updateAppearances(editor, nodeIds, (appearance) => {
    if (!isIndex(slot.index, appearance[slot.list].length)) {
      return null;
    }

    return {
      ...appearance,
      [slot.list]: appearance[slot.list].filter((_layer, index) => {
        return index !== slot.index;
      }),
    };
  });
};

export const moveAppearanceLayer = (
  editor,
  slot: AppearanceSlot,
  toIndex: number,
  nodeIds = editor.selectedNodeIds
) => {
  return updateAppearances(editor, nodeIds, (appearance) => {
    const length = appearance[slot.list].length;

    if (!(isIndex(slot.index, length) && isIndex(toIndex, length))) {
      return null;
    }

    const layers = [...appearance[slot.list]];
    const [layer] = layers.splice(slot.index, 1);

    layers.splice(toIndex, 0, layer);

    return toIndex === slot.index
      ? null
      : { ...appearance, [slot.list]: layers };
  });
};

// Replaces whole stacks (automation, paste style, resolving mixed stacks).
// The input must validate; each node keeps the given layer ids.
export const setAppearance = (
  editor,
  appearance: Appearance,
  nodeIds = editor.selectedNodeIds
) => {
  const result = appearanceSchema.safeParse(appearance);

  if (!result.success) {
    return false;
  }

  return updateAppearances(editor, nodeIds, () => result.data);
};

// One history step for the whole selection. Nodes the update cannot apply to
// (missing slot, full list) are left unchanged.
const updateAppearances = (
  editor,
  nodeIds: string[],
  update: (appearance: Appearance) => Appearance | null
) => {
  const nextById = new Map<string, Appearance>();

  for (const nodeId of getAppearanceTargetNodeIds(editor, nodeIds)) {
    const appearance = getNodeAppearance(editor.getNode(nodeId));
    const next = update(appearance);

    if (next && next !== appearance) {
      nextById.set(nodeId, next);
    }
  }

  if (nextById.size === 0) {
    return false;
  }

  editor.updateNodes([...nextById.keys()], (node) => {
    return { appearance: nextById.get(node.id) };
  });

  return true;
};

const applyLayerPatch = (
  list: AppearanceList,
  layer: FillLayer | StrokeLayer,
  { color, ...patch }: LayerPatch
) => {
  const next = { ...layer } as FillLayer & Partial<StrokeLayer>;

  if (color !== undefined) {
    const parsed = parseColor(color);

    if (!parsed) {
      return null;
    }

    next.paint = { ...layer.paint, color: parsed.color };
  }

  if (typeof patch.enabled === "boolean") {
    next.enabled = patch.enabled;
  }

  if (isFiniteNumber(patch.opacity)) {
    next.opacity = clamp(patch.opacity, 0, 1);
  }

  if (list === "strokes") {
    if (isFiniteNumber(patch.width)) {
      next.width = clamp(patch.width, 0, MAX_STROKE_WIDTH);
    }

    if (isFiniteNumber(patch.miterLimit)) {
      next.miterLimit = Math.max(1, patch.miterLimit);
    }

    if (patch.cap) {
      next.cap = patch.cap;
    }

    if (patch.join) {
      next.join = patch.join;
    }
  }

  return next;
};

const isIndex = (value: number, length: number) => {
  return Number.isInteger(value) && value >= 0 && value < length;
};

const isFiniteNumber = (value: unknown): value is number => {
  return typeof value === "number" && Number.isFinite(value);
};

const clamp = (value: number, min: number, max: number) => {
  return Math.min(max, Math.max(min, value));
};

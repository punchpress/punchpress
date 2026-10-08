import {
  appearanceSchema,
  MAX_APPEARANCE_LAYERS,
  parseColor,
  STROKE_ALIGN_VALUES,
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
import type {
  Appearance,
  FillLayer,
  Paint,
  StrokeLayer,
} from "./appearance-types";
import { getNodeAppearance } from "./node-appearance";
import { getRenderedAppearanceObject } from "./rendered-appearance";
import {
  convertPaint,
  getGradientAngle,
  normalizeLinearGradient,
  rotateGradientTo,
} from "./paint";

export type AppearanceList = "fills" | "strokes";

export interface AppearanceSlot {
  index: number;
  list: AppearanceList;
}

type LayerPatch = Partial<Omit<StrokeLayer, "id" | "paint">> & {
  // A CSS color for a solid paint. Its alpha is ignored: layer opacity is
  // patched separately through `opacity`. Rejected for gradient layers.
  color?: string;
  // A whole paint; gradients are normalized (clamped, sorted, ids kept).
  paint?: Paint;
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
    const id = createLayerId(appearance, "fill");
    // A new fill copies the top fill's paint (solid or gradient).
    const layer = topFill
      ? { ...topFill, enabled: true, id }
      : createSolidFill("#000000", id);

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

// Switches a layer between solid and linear paint (see convertPaint): solid →
// linear fades the color out left to right; linear → solid keeps the first
// stop and folds its opacity into the layer.
export const setPaintKind = (
  editor,
  slot: AppearanceSlot,
  kind: Paint["kind"],
  nodeIds = editor.selectedNodeIds
) => {
  return updateLayers(editor, slot, nodeIds, (layer) => {
    const converted = convertPaint(layer.paint, kind);

    return converted.paint === layer.paint
      ? null
      : {
          ...layer,
          opacity: clamp(layer.opacity * converted.opacityScale, 0, 1),
          paint: converted.paint,
        };
  });
};

// Points a linear gradient along `angle` degrees in each node's own units
// (0 = left to right, 90 = top to bottom), measured through its paint box.
export const setGradientAngle = (
  editor,
  slot: AppearanceSlot,
  angle: number,
  nodeIds = editor.selectedNodeIds
) => {
  if (!Number.isFinite(angle)) {
    return false;
  }

  return updateLayers(editor, slot, nodeIds, (layer, nodeId) => {
    const box = getRenderedPaintBox(editor, nodeId);

    return layer.paint.kind === "linear-gradient" && box
      ? { ...layer, paint: rotateGradientTo(layer.paint, angle, box) }
      : null;
  });
};

// The first gradient target's angle, for display.
export const getAppearanceGradientAngle = (
  editor,
  slot: AppearanceSlot,
  nodeIds = editor.selectedNodeIds
) => {
  for (const nodeId of getAppearanceTargetNodeIds(editor, nodeIds)) {
    const layer = getNodeAppearance(editor.getNode(nodeId))[slot.list][
      slot.index
    ];
    const box =
      layer?.paint.kind === "linear-gradient"
        ? getRenderedPaintBox(editor, nodeId)
        : null;

    if (layer?.paint.kind === "linear-gradient" && box) {
      return getGradientAngle(layer.paint, box);
    }
  }

  return null;
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

const updateLayers = (
  editor,
  slot: AppearanceSlot,
  nodeIds: string[],
  update: (
    layer: FillLayer | StrokeLayer,
    nodeId: string
  ) => FillLayer | StrokeLayer | null
) => {
  const nextById = new Map<string, Appearance>();

  for (const nodeId of getAppearanceTargetNodeIds(editor, nodeIds)) {
    const appearance = getNodeAppearance(editor.getNode(nodeId));
    const layers = appearance[slot.list];

    if (!isIndex(slot.index, layers.length)) {
      continue;
    }

    const next = update(layers[slot.index], nodeId);

    if (next) {
      nextById.set(nodeId, {
        ...appearance,
        [slot.list]: layers.map((layer, index) => {
          return index === slot.index ? next : layer;
        }),
      });
    }
  }

  return applyAppearances(editor, nextById);
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

  return applyAppearances(editor, nextById);
};

const applyAppearances = (editor, nextById: Map<string, Appearance>) => {
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
  { color, paint, ...patch }: LayerPatch
) => {
  const next = { ...layer } as FillLayer & Partial<StrokeLayer>;

  if (paint !== undefined) {
    const normalized = normalizePaint(paint);

    if (!normalized) {
      return null;
    }

    next.paint = normalized;
  }

  if (color !== undefined) {
    const parsed = parseColor(color);

    if (!parsed || next.paint.kind !== "solid") {
      return null;
    }

    next.paint = { color: parsed.color, kind: "solid" };
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

    if (patch.align && STROKE_ALIGN_VALUES.includes(patch.align)) {
      next.align = patch.align;
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

const normalizePaint = (paint: Paint): Paint | null => {
  if (paint?.kind === "linear-gradient") {
    return normalizeLinearGradient(paint);
  }

  const color = paint?.kind === "solid" ? parseColor(paint.color)?.color : null;

  return color ? { color, kind: "solid" } : null;
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

// The box the node's layers actually paint through.
const getRenderedPaintBox = (editor, nodeId: string) => {
  return (
    getRenderedAppearanceObject(editor, nodeId)?.paintBox ??
    editor.getNodeRenderGeometry(nodeId)?.paintBox ??
    null
  );
};

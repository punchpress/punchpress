import { parseColor, toRgb } from "@punchpress/punch-schema";
import { getNodeAppearance } from "../appearance/node-appearance";
import { supportsNodeProperty } from "../nodes/node-property-support";
import { isContainerNode } from "../nodes/node-tree";
import { measurePerf } from "../perf/perf-hooks";
import { PERF_SPANS } from "../perf/perf-labels";

const MAX_VISIBLE_SELECTION_COLORS = 12;

const createSelectionColorId = (value) => {
  return JSON.stringify(value);
};

const createSelectionColorFieldId = (nodeId, fieldKey) => {
  return `${nodeId}:${fieldKey}`;
};

// Every color a node paints with: an artboard background, each enabled solid
// layer, and each stop of an enabled gradient layer. Values are canonical
// colors (with the layer or stop opacity as alpha) so equal paints group;
// writers replace only that field.
const getNodeColorFields = (node) => {
  if (supportsNodeProperty(node, "background")) {
    const color = parseColor(node.background)?.color;

    return color
      ? [
          {
            key: "background",
            setValue: (_node, value) => ({ background: value }),
            value: color,
          },
        ]
      : [];
  }

  if (!supportsNodeProperty(node, "appearance")) {
    return [];
  }

  const appearance = getNodeAppearance(node);

  return (["fills", "strokes"] as const).flatMap((list) => {
    return appearance[list]
      .filter((layer) => layer.enabled)
      .flatMap((layer) => {
        const { paint } = layer;

        if (paint.kind === "linear-gradient") {
          return paint.stops.map((stop) => ({
            key: `${list}.${layer.id}.${stop.id}`,
            setValue: (currentNode, value) =>
              setStopColor(currentNode, list, layer.id, stop.id, value),
            value: formatPaintValue(stop.color, stop.opacity),
          }));
        }

        return [
          {
            key: `${list}.${layer.id}`,
            setValue: (currentNode, value) =>
              setLayerColor(currentNode, list, layer.id, value),
            value: formatPaintValue(paint.color, layer.opacity),
          },
        ];
      });
  });
};

// Selection colors group layers by color *and* opacity, so a swatch's alpha is
// the exact layer opacity it stands for and editing it is lossless.
const formatPaintValue = (color: string, opacity: number) => {
  if (opacity >= 1) {
    return color;
  }

  const { b, g, r } = toRgb(color);

  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

const setLayerColor = (node, list, layerId, value) => {
  const parsed = parseColor(value);
  const appearance = getNodeAppearance(node);

  if (!parsed) {
    return {};
  }

  return {
    appearance: {
      ...appearance,
      [list]: appearance[list].map((layer) => {
        return layer.id === layerId
          ? {
              ...layer,
              opacity: parsed.opacity,
              paint: { ...layer.paint, color: parsed.color },
            }
          : layer;
      }),
    },
  };
};

const setStopColor = (node, list, layerId, stopId, value) => {
  const parsed = parseColor(value);
  const appearance = getNodeAppearance(node);

  if (!parsed) {
    return {};
  }

  return {
    appearance: {
      ...appearance,
      [list]: appearance[list].map((layer) => {
        if (layer.id !== layerId || layer.paint.kind !== "linear-gradient") {
          return layer;
        }

        return {
          ...layer,
          paint: {
            ...layer.paint,
            stops: layer.paint.stops.map((stop) => {
              return stop.id === stopId
                ? { ...stop, color: parsed.color, opacity: parsed.opacity }
                : stop;
            }),
          },
        };
      }),
    },
  };
};

// The node as the live selection-color preview shows it: every previewed
// field rewritten to the preview value. Geometry is unaffected, so only paint
// re-renders. Returns the node itself when no preview targets it.
export const getSelectionColorPreviewNode = (editor, node) => {
  const preview = editor.selectionColorPreviewState;
  const fieldKeys = node && preview?.targetFieldKeysByNodeId.get(node.id);

  if (!fieldKeys) {
    return node;
  }

  let nextNode = node;

  for (const field of getNodeColorFields(node)) {
    if (fieldKeys.includes(field.key) && field.value === preview.baseValue) {
      nextNode = { ...nextNode, ...field.setValue(nextNode, preview.value) };
    }
  }

  return nextNode;
};

const getSelectionColorTargetNodeIds = (editor, nodeIds) => {
  const targetNodeIds: string[] = [];

  for (const nodeId of nodeIds) {
    const node = editor.getNode(nodeId);

    if (!node) {
      continue;
    }

    if (supportsSelectionColor(node)) {
      targetNodeIds.push(node.id);
    }

    if (isContainerNode(node)) {
      targetNodeIds.push(...editor.getDescendantLeafNodeIds(node.id));
      continue;
    }

    const targetNodeId = editor.getPathEditingTargetNodeId(node.id) || node.id;
    const targetNode = editor.getNode(targetNodeId);

    if (!targetNode) {
      continue;
    }

    if (supportsSelectionColor(targetNode)) {
      targetNodeIds.push(targetNode.id);
    }

    if (isContainerNode(targetNode)) {
      targetNodeIds.push(...editor.getDescendantLeafNodeIds(targetNode.id));
      continue;
    }

    if (!supportsSelectionColor(targetNode)) {
      targetNodeIds.push(targetNode.id);
    }
  }

  return [...new Set(targetNodeIds)];
};

const supportsSelectionColor = (node) => {
  return (
    supportsNodeProperty(node, "background") ||
    supportsNodeProperty(node, "appearance")
  );
};

const shouldExposeSelectionColors = (editor, nodeIds) => {
  if (nodeIds.length > 1) {
    return true;
  }

  if (nodeIds.length !== 1) {
    return false;
  }

  return isContainerNode(editor.getNode(nodeIds[0]));
};

const resolveSelectionColor = (editor, selectionColorId, nodeIds) => {
  return getSelectionColors(editor, nodeIds).find((color) => {
    return color.id === selectionColorId;
  });
};

const resolveSelectionColorTargetFields = (editor, selectionColor, nodeIds) => {
  const targetFieldKeysByNodeId = new Map();

  for (const nodeId of getSelectionColorTargetNodeIds(editor, nodeIds)) {
    const node = editor.getNode(nodeId);

    if (!node) {
      continue;
    }

    const fieldKeys = getNodeColorFields(node)
      .filter((field) => field.value === selectionColor.value)
      .map((field) => field.key);

    if (fieldKeys.length > 0) {
      targetFieldKeysByNodeId.set(node.id, fieldKeys);
    }
  }

  return targetFieldKeysByNodeId;
};

export const getSelectionColors = (
  editor,
  nodeIds = editor.selectedNodeIds
) => {
  return measurePerf(PERF_SPANS.selectionAppearanceAggregate, () => {
    if (!shouldExposeSelectionColors(editor, nodeIds)) {
      return [];
    }

    const colorsById = new Map();

    for (const nodeId of measurePerf(
      PERF_SPANS.selectionAppearanceTargets,
      () => getSelectionColorTargetNodeIds(editor, nodeIds)
    )) {
      const node = editor.getNode(nodeId);

      if (!node) {
        continue;
      }

      for (const field of getNodeColorFields(node)) {
        const id = createSelectionColorId(field.value);
        const existingColor = colorsById.get(id);

        if (existingColor) {
          existingColor.usageCount += 1;
          continue;
        }

        colorsById.set(id, {
          fieldId: createSelectionColorFieldId(node.id, field.key),
          id,
          usageCount: 1,
          value: field.value,
        });

        if (colorsById.size > MAX_VISIBLE_SELECTION_COLORS) {
          return [...colorsById.values()].slice(
            0,
            MAX_VISIBLE_SELECTION_COLORS
          );
        }
      }
    }

    return [...colorsById.values()];
  });
};

export const beginSelectionColorChange = (
  editor,
  selectionColorId,
  nodeIds = editor.selectedNodeIds
) => {
  return measurePerf(PERF_SPANS.selectionAppearanceChangeBegin, () => {
    const selectionColor = measurePerf(
      PERF_SPANS.selectionAppearanceChangeResolve,
      () => resolveSelectionColor(editor, selectionColorId, nodeIds)
    );

    if (!selectionColor) {
      return null;
    }

    const targetFieldKeysByNodeId = measurePerf(
      PERF_SPANS.selectionAppearanceChangeTargets,
      () => resolveSelectionColorTargetFields(editor, selectionColor, nodeIds)
    );

    if (targetFieldKeysByNodeId.size === 0) {
      return null;
    }

    return {
      baseValue: selectionColor.value,
      nodeIds: [...nodeIds],
      selectionColorId,
      targetFieldKeysByNodeId,
    };
  });
};

export const commitSelectionColorChange = (editor, session, value) => {
  if (!session) {
    return false;
  }

  const targetNodeIds = [...session.targetFieldKeysByNodeId.keys()];

  if (targetNodeIds.length === 0) {
    return false;
  }

  measurePerf(PERF_SPANS.selectionAppearanceChangeCommit, () => {
    editor.updateNodes(targetNodeIds, (node) => {
      const fieldKeys = session.targetFieldKeysByNodeId.get(node.id) || [];
      let nextNode = node;
      let patch = {};

      for (const field of getNodeColorFields(node)) {
        if (
          !fieldKeys.includes(field.key) ||
          field.value !== session.baseValue
        ) {
          continue;
        }

        const fieldPatch = field.setValue(nextNode, value);

        nextNode = { ...nextNode, ...fieldPatch };
        patch = { ...patch, ...fieldPatch };
      }

      return patch;
    });
  });

  return true;
};

export const setSelectionColor = (
  editor,
  selectionColorId,
  value,
  nodeIds = editor.selectedNodeIds
) => {
  return measurePerf(PERF_SPANS.selectionAppearanceSet, () => {
    const session = beginSelectionColorChange(
      editor,
      selectionColorId,
      nodeIds
    );

    if (!session) {
      return false;
    }

    return commitSelectionColorChange(editor, session, value);
  });
};

export const updateSelectionColorChange = (editor, session, value) => {
  if (!session) {
    return false;
  }

  editor.selectionColorPreviewState = {
    baseValue: session.baseValue,
    targetFieldKeysByNodeId: session.targetFieldKeysByNodeId,
    value,
  };
  editor.notifyInteractionPreviewChanged();

  return true;
};

export const cancelSelectionColorChange = (editor) => {
  if (!editor.selectionColorPreviewState) {
    return;
  }

  editor.selectionColorPreviewState = null;
  editor.notifyInteractionPreviewChanged();
};

export const getSelectionColorPreviewValue = (
  editor,
  nodeId,
  fieldKey,
  currentValue
) => {
  const preview = editor.selectionColorPreviewState;

  if (!preview || currentValue !== preview.baseValue) {
    return currentValue;
  }

  if (!preview.targetFieldKeysByNodeId.get(nodeId)?.includes(fieldKey)) {
    return currentValue;
  }

  return preview.value;
};

export const isSelectionColorPreviewAffectingNode = (editor, nodeId) => {
  const preview = editor.selectionColorPreviewState;

  if (!preview) {
    return false;
  }

  if (preview.targetFieldKeysByNodeId.has(nodeId)) {
    return true;
  }

  for (const targetNodeId of preview.targetFieldKeysByNodeId.keys()) {
    if (editor.isDescendantOf(targetNodeId, nodeId)) {
      return true;
    }
  }

  return false;
};

export const getSelectionColorPreviewForNode = (editor, nodeId) => {
  const preview = editor.selectionColorPreviewState;

  if (!(preview && isSelectionColorPreviewAffectingNode(editor, nodeId))) {
    return null;
  }

  return {
    baseValue: preview.baseValue,
    value: preview.value,
  };
};

import { supportsNodeProperty } from "../nodes/node-property-support";
import { isContainerNode } from "../nodes/node-tree";
import { measurePerf } from "../perf/perf-hooks";
import { getPropertyDescriptor } from "./property-descriptors";

const SELECTION_COLOR_PROPERTY_IDS = ["background", "fill", "stroke"];
const MAX_VISIBLE_SELECTION_COLORS = 12;

const createSelectionColorId = (value) => {
  return JSON.stringify(value);
};

const createSelectionColorFieldId = (nodeId, propertyId) => {
  return `${nodeId}:${propertyId}`;
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
  return SELECTION_COLOR_PROPERTY_IDS.some((propertyId) => {
    return supportsNodeProperty(node, propertyId);
  });
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

const resolveSelectionColorTargetProperties = (
  editor,
  selectionColor,
  nodeIds
) => {
  const targetPropertyIdsByNodeId = new Map();

  for (const nodeId of getSelectionColorTargetNodeIds(editor, nodeIds)) {
    const node = editor.getNode(nodeId);

    if (!node) {
      continue;
    }

    for (const propertyId of SELECTION_COLOR_PROPERTY_IDS) {
      if (!supportsNodeProperty(node, propertyId)) {
        continue;
      }

      const descriptor = getPropertyDescriptor(propertyId);

      if (descriptor?.getValue(node) !== selectionColor.value) {
        continue;
      }

      const propertyIds = targetPropertyIdsByNodeId.get(node.id) || [];
      propertyIds.push(propertyId);
      targetPropertyIdsByNodeId.set(node.id, propertyIds);
    }
  }

  return targetPropertyIdsByNodeId;
};

export const getSelectionColors = (editor, nodeIds = editor.selectedNodeIds) => {
  return measurePerf("selection.colors", () => {
    if (!shouldExposeSelectionColors(editor, nodeIds)) {
      return [];
    }

    const colorsById = new Map();

    for (const nodeId of measurePerf("selection.color.targets", () =>
      getSelectionColorTargetNodeIds(editor, nodeIds)
    )) {
      const node = editor.getNode(nodeId);

      if (!node) {
        continue;
      }

      for (const propertyId of SELECTION_COLOR_PROPERTY_IDS) {
        if (!supportsNodeProperty(node, propertyId)) {
          continue;
        }

        const descriptor = getPropertyDescriptor(propertyId);
        const value = descriptor?.getValue(node);

        if (value == null) {
          continue;
        }

        const id = createSelectionColorId(value);
        const existingColor = colorsById.get(id);

        if (existingColor) {
          existingColor.usageCount += 1;
          continue;
        }

        colorsById.set(id, {
          fieldId: createSelectionColorFieldId(node.id, propertyId),
          id,
          usageCount: 1,
          value,
        });

        if (colorsById.size > MAX_VISIBLE_SELECTION_COLORS) {
          return [...colorsById.values()].slice(0, MAX_VISIBLE_SELECTION_COLORS);
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
  return measurePerf("selection.color.change.begin", () => {
    const selectionColor = measurePerf("selection.color.change.resolve", () =>
      resolveSelectionColor(editor, selectionColorId, nodeIds)
    );

    if (!selectionColor) {
      return null;
    }

    const targetPropertyIdsByNodeId = measurePerf(
      "selection.color.change.targets",
      () => resolveSelectionColorTargetProperties(editor, selectionColor, nodeIds)
    );

    if (targetPropertyIdsByNodeId.size === 0) {
      return null;
    }

    return {
      baseValue: selectionColor.value,
      nodeIds: [...nodeIds],
      selectionColorId,
      targetPropertyIdsByNodeId,
    };
  });
};

export const commitSelectionColorChange = (editor, session, value) => {
  if (!session) {
    return false;
  }

  const targetNodeIds = [...session.targetPropertyIdsByNodeId.keys()];

  if (targetNodeIds.length === 0) {
    return false;
  }

  measurePerf("selection.color.change.commit", () => {
    editor.updateNodes(targetNodeIds, (node) => {
      const propertyIds = session.targetPropertyIdsByNodeId.get(node.id) || [];
      const nextNode = {};

      for (const propertyId of propertyIds) {
        if (!supportsNodeProperty(node, propertyId)) {
          continue;
        }

        const descriptor = getPropertyDescriptor(propertyId);

        if (descriptor?.getValue(node) !== session.baseValue) {
          continue;
        }

        Object.assign(nextNode, descriptor.setValue(node, value));
      }

      return nextNode;
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
  return measurePerf("selection.color.set", () => {
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

import { supportsNodeProperty } from "../nodes/node-property-support";
import { isContainerNode } from "../nodes/node-tree";
import { getPropertyDescriptor } from "./property-descriptors";

const SELECTION_COLOR_PROPERTY_IDS = ["fill", "stroke"];

const createSelectionColorId = (value) => {
  return JSON.stringify(value);
};

const getSelectionColorTargetNodeIds = (editor, nodeIds) => {
  const targetNodeIds: string[] = [];

  for (const nodeId of nodeIds) {
    const node = editor.getNode(nodeId);

    if (!node) {
      continue;
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

    if (isContainerNode(targetNode)) {
      targetNodeIds.push(...editor.getDescendantLeafNodeIds(targetNode.id));
      continue;
    }

    targetNodeIds.push(targetNode.id);
  }

  return [...new Set(targetNodeIds)];
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

export const getSelectionColors = (
  editor,
  nodeIds = editor.selectedNodeIds
) => {
  if (!shouldExposeSelectionColors(editor, nodeIds)) {
    return [];
  }

  const colorsById = new Map();

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
        id,
        usageCount: 1,
        value,
      });
    }
  }

  return [...colorsById.values()];
};

export const setSelectionColor = (
  editor,
  selectionColorId,
  value,
  nodeIds = editor.selectedNodeIds
) => {
  const selectionColor = getSelectionColors(editor, nodeIds).find((color) => {
    return color.id === selectionColorId;
  });

  if (!selectionColor) {
    return false;
  }

  const targetNodeIds = getSelectionColorTargetNodeIds(editor, nodeIds).filter(
    (nodeId) => {
      const node = editor.getNode(nodeId);

      if (!node) {
        return false;
      }

      return SELECTION_COLOR_PROPERTY_IDS.some((propertyId) => {
        if (!supportsNodeProperty(node, propertyId)) {
          return false;
        }

        return (
          getPropertyDescriptor(propertyId)?.getValue(node) ===
          selectionColor.value
        );
      });
    }
  );

  if (targetNodeIds.length === 0) {
    return false;
  }

  editor.updateNodes(targetNodeIds, (node) => {
    const nextNode = {};

    for (const propertyId of SELECTION_COLOR_PROPERTY_IDS) {
      if (!supportsNodeProperty(node, propertyId)) {
        continue;
      }

      const descriptor = getPropertyDescriptor(propertyId);
      if (descriptor?.getValue(node) !== selectionColor.value) {
        continue;
      }

      Object.assign(nextNode, descriptor.setValue(node, value));
    }

    return nextNode;
  });

  return true;
};

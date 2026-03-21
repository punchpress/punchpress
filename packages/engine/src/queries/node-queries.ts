import { getEditableNodeFrame } from "../editable-node-frame";
import {
  getDescendantLeafNodeIds,
  isGroupNode,
  isTextNode,
} from "../nodes/node-tree";
import { isNodeVisible } from "../shapes/warp-text/model";

export const getNode = (editor, nodeId) => {
  if (!nodeId) {
    return null;
  }

  return editor.nodes.find((node) => node.id === nodeId) || null;
};

const isNodeEffectivelyVisible = (editor, node) => {
  if (!(node && isNodeVisible(node))) {
    return false;
  }

  if (!node.parentId || node.parentId === "root") {
    return true;
  }

  return isNodeEffectivelyVisible(editor, editor.getNode(node.parentId));
};

export const getLayerRow = (editor, nodeId) => {
  const nodeIndex = editor.nodes.findIndex((node) => node.id === nodeId);
  if (nodeIndex < 0) {
    return null;
  }

  const node = editor.nodes[nodeIndex];
  const siblingIds = editor.getChildNodeIds(node.parentId);
  const siblingIndex = siblingIds.indexOf(node.id);
  const layerIndex = siblingIds.length - 1 - siblingIndex;
  const groupSiblingIds = siblingIds.filter((siblingId) => {
    return isGroupNode(editor.getNode(siblingId));
  });
  const groupIndex = groupSiblingIds.indexOf(node.id);
  const groupLayerIndex =
    groupIndex >= 0 ? groupSiblingIds.length - 1 - groupIndex : -1;
  const isVisible = isNodeEffectivelyVisible(editor, node);
  let label = node.name || `Group ${groupLayerIndex + 1}`;

  if (isTextNode(node)) {
    label = node.text.trim().length > 0 ? node.text : `Text ${layerIndex + 1}`;
  }

  return {
    isBackmost: siblingIndex === 0,
    isFrontmost: siblingIndex === siblingIds.length - 1,
    isGroup: isGroupNode(node),
    isSelected: editor.isSelected(node.id),
    isVisible,
    label,
    node,
    visibilityLabel: isVisible ? "Hide layer" : "Show layer",
  };
};

export const getNodeGeometry = (editor, nodeId) => {
  if (!nodeId) {
    return null;
  }

  const node = getNode(editor, nodeId);
  if (!isTextNode(node)) {
    return null;
  }

  return editor.geometry.getById(editor.nodes, editor.fontRevision, nodeId);
};

export const getNodeFrame = (editor, nodeId) => {
  if (!nodeId) {
    return null;
  }

  const node = getNode(editor, nodeId);
  if (!node) {
    return null;
  }

  if (isGroupNode(node)) {
    const descendantLeafNodeIds = getDescendantLeafNodeIds(
      editor.nodes,
      nodeId
    );
    if (descendantLeafNodeIds.length === 0) {
      return null;
    }

    const bounds = editor.getSelectionBounds(descendantLeafNodeIds);
    if (!bounds) {
      return null;
    }

    return {
      bounds,
      transform: undefined,
    };
  }

  return getEditableNodeFrame(node, getNodeGeometry(editor, nodeId), {
    useSelectionBounds: Boolean(editor.getNodeTransformElement(nodeId)),
  });
};

export const getSelectionFrameKey = (
  editor,
  nodeIds = editor.selectedNodeIds
) => {
  return nodeIds
    .map((nodeId) => {
      const frame = getNodeFrame(editor, nodeId);

      if (!frame) {
        return nodeId;
      }

      return JSON.stringify({
        bounds: frame.bounds,
        nodeId,
        transform: frame.transform || "",
      });
    })
    .join("|");
};

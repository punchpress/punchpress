import { getEditableNodeFrame } from "../editable-node-frame";
import { isNodeVisible } from "../shapes/warp-text/model";

export const getNode = (editor, nodeId) => {
  if (!nodeId) {
    return null;
  }

  return editor.nodes.find((node) => node.id === nodeId) || null;
};

export const getLayerRow = (editor, nodeId) => {
  const nodeIndex = editor.nodes.findIndex((node) => node.id === nodeId);
  if (nodeIndex < 0) {
    return null;
  }

  const node = editor.nodes[nodeIndex];
  const layerIndex = editor.nodes.length - 1 - nodeIndex;
  const isVisible = isNodeVisible(node);
  const label =
    node.text.trim().length > 0 ? node.text : `Text ${layerIndex + 1}`;

  return {
    isBackmost: nodeIndex === 0,
    isFrontmost: nodeIndex === editor.nodes.length - 1,
    isSelected: editor.isNodeSelected(node.id),
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

  return getEditableNodeFrame(node, getNodeGeometry(editor, nodeId));
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

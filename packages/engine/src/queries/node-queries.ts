import {
  getNodeEditCapabilities as getNodeSurfaceEditCapabilities,
  getNodeSurfaceFrame,
  getNodeSurfaceGeometry,
  getNodeHitBounds as getNodeSurfaceHitBounds,
  getNodeSurfaceLocalBounds,
} from "../nodes/node-capabilities";
import { isGroupNode, isTextNode } from "../nodes/node-tree";
import {
  getNodeCssTransform,
  getNodeX,
  getNodeY,
  isNodeVisible,
} from "../nodes/text/model";

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

export const getNodeRenderGeometry = (editor, nodeId) => {
  return getNodeSurfaceGeometry(editor, nodeId);
};

export const getNodeRenderBounds = (editor, nodeId) => {
  return getNodeSurfaceLocalBounds(editor, nodeId, "render");
};

export const getNodeTransformBounds = (editor, nodeId) => {
  return getNodeSurfaceLocalBounds(editor, nodeId, "transform", {
    useSelectionBounds: Boolean(editor.getNodeTransformElement(nodeId)),
  });
};

export const getNodeHitBounds = (editor, nodeId) => {
  return getNodeSurfaceHitBounds(editor, nodeId);
};

export const getNodeEditCapabilities = (editor, nodeId) => {
  return getNodeSurfaceEditCapabilities(editor, nodeId);
};

export const getNodeRenderFrame = (editor, nodeId) => {
  if (!nodeId) {
    return null;
  }

  const node = getNode(editor, nodeId);
  if (!node) {
    return null;
  }

  return getNodeSurfaceFrame(editor, nodeId, "render");
};

export const getNodeSelectionFrame = (editor, nodeId) => {
  if (!nodeId) {
    return null;
  }

  const node = getNode(editor, nodeId);
  if (!node) {
    return null;
  }

  return getNodeSurfaceFrame(editor, nodeId, "selection", {
    useSelectionBounds: Boolean(editor.getNodeTransformElement(nodeId)),
  });
};

export const getNodeTransformFrame = (editor, nodeId) => {
  if (!nodeId) {
    return null;
  }

  const node = getNode(editor, nodeId);
  const bounds = getNodeTransformBounds(editor, nodeId);

  if (!(node && bounds)) {
    return null;
  }

  return {
    bounds: {
      height: bounds.height,
      maxX: getNodeX(node) + bounds.maxX,
      maxY: getNodeY(node) + bounds.maxY,
      minX: getNodeX(node) + bounds.minX,
      minY: getNodeY(node) + bounds.minY,
      width: bounds.width,
    },
    transform: getNodeCssTransform(node),
  };
};

export const getNodeFrame = (editor, nodeId) => {
  return getNodeSelectionFrame(editor, nodeId);
};

export const getSelectionFrameKey = (
  editor,
  nodeIds = editor.selectedNodeIds
) => {
  const previewDelta = getSelectionPreviewDelta(editor, nodeIds);

  return [
    ...nodeIds.map((nodeId) => {
      const frame = getNodeSelectionFrame(editor, nodeId);

      if (!frame) {
        return nodeId;
      }

      return JSON.stringify({
        bounds: frame.bounds,
        nodeId,
        transform: frame.transform || "",
      });
    }),
    JSON.stringify(previewDelta),
  ].join("|");
};

export const getSelectionPreviewDelta = (
  editor,
  nodeIds = editor.selectedNodeIds
) => {
  const preview = editor.selectionDragPreview;

  if (
    !(
      preview?.delta &&
      preview.nodeIds?.length === nodeIds.length &&
      nodeIds.every((nodeId) => preview.nodeIds.includes(nodeId))
    )
  ) {
    return null;
  }

  return preview.delta;
};

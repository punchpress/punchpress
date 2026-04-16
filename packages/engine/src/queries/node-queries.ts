import {
  getNodeEditablePathSession as getNodeSurfaceEditablePathSession,
  getNodeEditCapabilities as getNodeSurfaceEditCapabilities,
  getNodeSurfaceFrame,
  getNodeSurfaceGeometry,
  getNodeHitBounds as getNodeSurfaceHitBounds,
  getNodeSurfaceLocalBounds,
} from "../nodes/node-capabilities";
import {
  isContainerNode,
  isGroupNode,
  isPathNode,
  isShapeNode,
  isTextNode,
  isVectorNode,
} from "../nodes/node-tree";
import {
  getNodeRotation,
  getNodeX,
  getNodeY,
  isNodeVisible,
} from "../nodes/text/model";
import {
  getLocalBoundsCenter,
  getNodeWorldPoint,
  getWorldPointFromTransformFrame,
  rotatePointAround,
} from "../primitives/rotation";
import { getOverlayWorldFrame } from "./overlay-frame";

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
  const containerSiblingIds = siblingIds.filter((siblingId) => {
    return isContainerNode(editor.getNode(siblingId));
  });
  const containerIndex = containerSiblingIds.indexOf(node.id);
  const containerLayerIndex =
    containerIndex >= 0 ? containerSiblingIds.length - 1 - containerIndex : -1;
  const isVisible = isNodeEffectivelyVisible(editor, node);
  let label = node.name || `Group ${containerLayerIndex + 1}`;

  if (isTextNode(node)) {
    label = node.text.trim().length > 0 ? node.text : `Text ${layerIndex + 1}`;
  } else if (isShapeNode(node)) {
    label = `${node.shape[0].toUpperCase()}${node.shape.slice(1)} ${layerIndex + 1}`;
  } else if (isVectorNode(node)) {
    label = node.name || `Vector ${containerLayerIndex + 1}`;
  } else if (isPathNode(node)) {
    label = `Path ${layerIndex + 1}`;
  }

  return {
    isBackmost: siblingIndex === 0,
    isContainer: isContainerNode(node),
    isFrontmost: siblingIndex === siblingIds.length - 1,
    isGroup: isGroupNode(node),
    isSelected: editor.isSelected(node.id),
    isVector: isVectorNode(node),
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

export const getNodeRenderGeometry = (editor, nodeId) => {
  return getNodeSurfaceGeometry(editor, nodeId);
};

export const getNodeRenderBounds = (editor, nodeId) => {
  return getNodeSurfaceLocalBounds(editor, nodeId, "render");
};

export const getNodeTransformBounds = (editor, nodeId) => {
  const isPathEditing = editor.isPathEditing(nodeId);

  return getNodeSurfaceLocalBounds(editor, nodeId, "transform", {
    useGuideBounds: isPathEditing,
    useSelectionBounds:
      !isPathEditing && Boolean(editor.getNodeTransformElement(nodeId)),
  });
};

export const getNodeHitBounds = (editor, nodeId) => {
  return getNodeSurfaceHitBounds(editor, nodeId);
};

export const getNodeEditCapabilities = (editor, nodeId) => {
  return getNodeSurfaceEditCapabilities(editor, nodeId);
};

export const getEditablePathSession = (editor, nodeId) => {
  return getNodeSurfaceEditablePathSession(editor, nodeId);
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

  if (editor.isPathEditing(nodeId)) {
    return getNodeSurfaceFrame(editor, nodeId, "selection", {
      useSelectionBounds: Boolean(editor.getNodeTransformElement(nodeId)),
    });
  }

  const frame = getNodeSurfaceFrame(editor, nodeId, "selection", {
    useSelectionBounds: Boolean(editor.getNodeTransformElement(nodeId)),
  });

  if (frame) {
    return frame;
  }

  const bounds = getNodeSurfaceLocalBounds(editor, nodeId, "selection", {
    useSelectionBounds: Boolean(editor.getNodeTransformElement(nodeId)),
  });

  return bounds ? getOverlayWorldFrame(node, bounds) : null;
};

export const getNodeTransformFrame = (editor, nodeId) => {
  if (!nodeId) {
    return null;
  }

  const node = getNode(editor, nodeId);
  const bounds = getNodeTransformBounds(editor, nodeId);
  const isPathEditing = editor.isPathEditing(nodeId);
  const geometry = isPathEditing ? editor.getNodeGeometry(nodeId) : null;

  if (!(node && bounds)) {
    return getNodeSurfaceFrame(editor, nodeId, "transform", {
      useSelectionBounds: Boolean(editor.getNodeTransformElement(nodeId)),
    });
  }

  if (isPathEditing && geometry?.bbox) {
    const renderCenter = getLocalBoundsCenter(geometry.bbox);
    const worldCenter = {
      x: getNodeX(node) + renderCenter.x,
      y: getNodeY(node) + renderCenter.y,
    };
    const transformFrame = {
      localCenter: renderCenter,
      rotation: getNodeRotation(node) || 0,
      scaleX: node.transform.scaleX ?? 1,
      scaleY: node.transform.scaleY ?? 1,
      worldCenter,
    };
    const corners = [
      { x: bounds.minX, y: bounds.minY },
      { x: bounds.maxX, y: bounds.minY },
      { x: bounds.maxX, y: bounds.maxY },
      { x: bounds.minX, y: bounds.maxY },
    ].map((point) => getWorldPointFromTransformFrame(transformFrame, point));
    const xs = corners.map((point) => point.x);
    const ys = corners.map((point) => point.y);

    return {
      bounds: {
        height: Math.max(...ys) - Math.min(...ys),
        maxX: Math.max(...xs),
        maxY: Math.max(...ys),
        minX: Math.min(...xs),
        minY: Math.min(...ys),
        width: Math.max(...xs) - Math.min(...xs),
      },
      transform: undefined,
    };
  }

  return (
    getNodeSurfaceFrame(editor, nodeId, "transform", {
      useSelectionBounds: Boolean(editor.getNodeTransformElement(nodeId)),
    }) || getOverlayWorldFrame(node, bounds)
  );
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

const applyPreviewDeltaToBounds = (bounds, previewDelta) => {
  if (!bounds) {
    return null;
  }

  if (!previewDelta) {
    return bounds;
  }

  return {
    ...bounds,
    maxX: bounds.maxX + previewDelta.x,
    maxY: bounds.maxY + previewDelta.y,
    minX: bounds.minX + previewDelta.x,
    minY: bounds.minY + previewDelta.y,
  };
};

const getBoundsCenter = (bounds) => {
  if (!bounds) {
    return null;
  }

  return {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
  };
};

const normalizeRotationDelta = (rotation) => {
  let nextRotation = rotation;

  while (nextRotation > 180) {
    nextRotation -= 360;
  }

  while (nextRotation < -180) {
    nextRotation += 360;
  }

  return nextRotation;
};

const getSharedSelectionRotation = (editor, nodeIds) => {
  const rotations = nodeIds
    .map((nodeId) => getNode(editor, nodeId))
    .filter(Boolean)
    .map((node) => getNodeRotation(node) || 0);

  if (rotations.length === 0) {
    return 0;
  }

  const firstRotation = rotations[0];
  const hasSharedRotation = rotations.every((rotation) => {
    return Math.abs(normalizeRotationDelta(rotation - firstRotation)) <= 0.1;
  });

  return hasSharedRotation ? firstRotation : 0;
};

const getSelectionFrameBounds = (editor, nodeIds) => {
  const bounds = nodeIds
    .map((nodeId) => editor.getNodeSelectionFrame(nodeId)?.bounds)
    .filter(Boolean);

  if (bounds.length === 0) {
    return null;
  }

  const minX = Math.min(...bounds.map((bbox) => bbox.minX));
  const minY = Math.min(...bounds.map((bbox) => bbox.minY));
  const maxX = Math.max(...bounds.map((bbox) => bbox.maxX));
  const maxY = Math.max(...bounds.map((bbox) => bbox.maxY));

  return {
    height: maxY - minY,
    maxX,
    maxY,
    minX,
    minY,
    width: maxX - minX,
  };
};

export const getSelectionTransformFrame = (
  editor,
  nodeIds = editor.selectedNodeIds
) => {
  const requestedNodeIds = nodeIds.filter((nodeId) => editor.getNode(nodeId));

  if (requestedNodeIds.length === 0) {
    return null;
  }

  const previewNodeIds = editor.getEffectiveSelectionNodeIds(requestedNodeIds);
  const previewDelta = getSelectionPreviewDelta(editor, previewNodeIds);

  if (
    requestedNodeIds.length === 1 &&
    !isContainerNode(editor.getNode(requestedNodeIds[0]))
  ) {
    const selectedNode = editor.getNode(requestedNodeIds[0]);
    const frame = editor.getNodeTransformFrame(requestedNodeIds[0]);

    if (!(selectedNode && frame)) {
      return null;
    }

    return {
      bounds: applyPreviewDeltaToBounds(frame.bounds, previewDelta),
      transform: frame.transform,
    };
  }

  const selectionBounds = getSelectionFrameBounds(editor, previewNodeIds);

  if (!selectionBounds) {
    return null;
  }

  const sharedRotation = getSharedSelectionRotation(editor, previewNodeIds);

  if (sharedRotation === 0) {
    return {
      bounds: applyPreviewDeltaToBounds(selectionBounds, previewDelta),
      transform: undefined,
    };
  }

  const selectionCenter = getBoundsCenter(selectionBounds);

  if (!selectionCenter) {
    return null;
  }

  const projectedCorners = previewNodeIds.flatMap((nodeId) => {
    const node = editor.getNode(nodeId);
    const bounds = editor.getNodeTransformBounds(nodeId);

    if (!(node && bounds)) {
      return [];
    }

    return [
      { x: bounds.minX, y: bounds.minY },
      { x: bounds.maxX, y: bounds.minY },
      { x: bounds.maxX, y: bounds.maxY },
      { x: bounds.minX, y: bounds.maxY },
    ]
      .map((point) => getNodeWorldPoint(node, bounds, point))
      .map((point) =>
        rotatePointAround(point, selectionCenter, -sharedRotation)
      );
  });

  if (projectedCorners.length === 0) {
    return null;
  }

  const minX = Math.min(...projectedCorners.map((point) => point.x));
  const minY = Math.min(...projectedCorners.map((point) => point.y));
  const maxX = Math.max(...projectedCorners.map((point) => point.x));
  const maxY = Math.max(...projectedCorners.map((point) => point.y));

  return {
    bounds: applyPreviewDeltaToBounds(
      {
        height: maxY - minY,
        maxX,
        maxY,
        minX,
        minY,
        width: maxX - minX,
      },
      previewDelta
    ),
    transform: `rotate(${sharedRotation}deg)`,
  };
};

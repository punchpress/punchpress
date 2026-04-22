import {
  getNodeEditablePathSession as getNodeSurfaceEditablePathSession,
  getNodeEditCapabilities as getNodeSurfaceEditCapabilities,
  getNodeSurfaceFrame,
  getNodeSurfaceGeometry,
  getNodeHitBounds as getNodeSurfaceHitBounds,
  getNodeSurfaceLocalBounds,
} from "../nodes/node-capabilities";
import {
  getDescendantLeafNodeIds,
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

const hasMeaningfulSelectionRotation = (editor, nodeIds) => {
  return nodeIds.some((nodeId) => {
    const node = getNode(editor, nodeId);

    return Math.abs(normalizeRotationDelta(getNodeRotation(node) || 0)) > 0.1;
  });
};

interface SelectionFramePoint {
  x: number;
  y: number;
}

interface SelectionFrameBounds {
  height: number;
  maxX: number;
  maxY: number;
  minX: number;
  minY: number;
  width: number;
}

interface OrientedSelectionFrame {
  area: number;
  bounds: SelectionFrameBounds;
  rotation: number;
}

const comparePointPosition = (
  left: SelectionFramePoint,
  right: SelectionFramePoint
) => {
  if (left.x !== right.x) {
    return left.x - right.x;
  }

  return left.y - right.y;
};

const getCrossProduct = (
  origin: SelectionFramePoint,
  left: SelectionFramePoint,
  right: SelectionFramePoint
) => {
  return (
    (left.x - origin.x) * (right.y - origin.y) -
    (left.y - origin.y) * (right.x - origin.x)
  );
};

const getConvexHull = (points: SelectionFramePoint[]) => {
  if (points.length <= 1) {
    return [...points];
  }

  const sortedPoints = [...points].sort(comparePointPosition);
  const lowerHull: SelectionFramePoint[] = [];

  for (const point of sortedPoints) {
    while (lowerHull.length >= 2) {
      const left = lowerHull.at(-2);
      const right = lowerHull.at(-1);

      if (!(left && right && getCrossProduct(left, right, point) <= 0)) {
        break;
      }

      lowerHull.pop();
    }

    lowerHull.push(point);
  }

  const upperHull: SelectionFramePoint[] = [];

  for (const point of [...sortedPoints].reverse()) {
    while (upperHull.length >= 2) {
      const left = upperHull.at(-2);
      const right = upperHull.at(-1);

      if (!(left && right && getCrossProduct(left, right, point) <= 0)) {
        break;
      }

      upperHull.pop();
    }

    upperHull.push(point);
  }

  lowerHull.pop();
  upperHull.pop();

  return [...lowerHull, ...upperHull];
};

const normalizeSelectionFrameRotation = (rotation) => {
  let nextRotation = normalizeRotationDelta(rotation);

  while (nextRotation <= -90) {
    nextRotation += 180;
  }

  while (nextRotation > 90) {
    nextRotation -= 180;
  }

  return Number.parseFloat(nextRotation.toFixed(2));
};

const getOrientedSelectionFrame = (
  worldCorners: SelectionFramePoint[]
): Omit<OrientedSelectionFrame, "area"> | null => {
  if (worldCorners.length === 0) {
    return null;
  }

  if (worldCorners.length === 1) {
    return {
      bounds: {
        height: 0,
        maxX: worldCorners[0].x,
        maxY: worldCorners[0].y,
        minX: worldCorners[0].x,
        minY: worldCorners[0].y,
        width: 0,
      },
      rotation: 0,
    };
  }

  const hull = getConvexHull(worldCorners);
  const candidateRotations = new Set(
    hull.map((point, index) => {
      const nextPoint = hull[(index + 1) % hull.length];

      return normalizeSelectionFrameRotation(
        (Math.atan2(nextPoint.y - point.y, nextPoint.x - point.x) * 180) /
          Math.PI
      );
    })
  );
  let bestFrame: OrientedSelectionFrame | null = null;

  for (const rotation of candidateRotations) {
    const unrotatedCorners = worldCorners.map((point) => {
      return rotatePointAround(point, { x: 0, y: 0 }, -rotation);
    });
    const minX = Math.min(...unrotatedCorners.map((point) => point.x));
    const minY = Math.min(...unrotatedCorners.map((point) => point.y));
    const maxX = Math.max(...unrotatedCorners.map((point) => point.x));
    const maxY = Math.max(...unrotatedCorners.map((point) => point.y));
    const width = maxX - minX;
    const height = maxY - minY;
    const area = width * height;

    if (bestFrame && bestFrame.area <= area) {
      continue;
    }

    const worldCenter = rotatePointAround(
      {
        x: minX + width / 2,
        y: minY + height / 2,
      },
      { x: 0, y: 0 },
      rotation
    );

    bestFrame = {
      area,
      bounds: {
        height,
        maxX: worldCenter.x + width / 2,
        maxY: worldCenter.y + height / 2,
        minX: worldCenter.x - width / 2,
        minY: worldCenter.y - height / 2,
        width,
      },
      rotation,
    };
  }

  return bestFrame
    ? {
        bounds: bestFrame.bounds,
        rotation: bestFrame.rotation,
      }
    : null;
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

const getSelectionFrameNodeIds = (editor, requestedNodeIds) => {
  const selectionFrameNodeIds: string[] = [];

  for (const nodeId of requestedNodeIds) {
    const node = editor.getNode(nodeId);

    if (!node) {
      continue;
    }

    if (!isContainerNode(node)) {
      selectionFrameNodeIds.push(nodeId);
      continue;
    }

    if (
      isVectorNode(node) &&
      editor.getNodeRenderGeometry(nodeId)?.selectionPoints?.length
    ) {
      selectionFrameNodeIds.push(nodeId);
      continue;
    }

    selectionFrameNodeIds.push(
      ...getDescendantLeafNodeIds(editor.nodes, nodeId)
    );
  }

  return [...new Set(selectionFrameNodeIds)];
};

const getSelectionFrameWorldPoints = (editor, nodeId) => {
  const node = editor.getNode(nodeId);

  if (!node) {
    return [];
  }

  if (isVectorNode(node)) {
    return editor.getNodeRenderGeometry(nodeId)?.selectionPoints || [];
  }

  const bounds = editor.getNodeTransformBounds(nodeId);

  if (!bounds) {
    return [];
  }

  return [
    { x: bounds.minX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.maxY },
    { x: bounds.minX, y: bounds.maxY },
  ].map((point) => getNodeWorldPoint(node, bounds, point));
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
  const selectionFrameNodeIds = getSelectionFrameNodeIds(
    editor,
    requestedNodeIds
  );
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

  const selectionBounds = getSelectionFrameBounds(
    editor,
    selectionFrameNodeIds
  );
  const worldCorners = selectionFrameNodeIds.flatMap((nodeId) => {
    return getSelectionFrameWorldPoints(editor, nodeId);
  });

  if (!selectionBounds) {
    return null;
  }

  const sharedRotation = getSharedSelectionRotation(editor, previewNodeIds);

  if (sharedRotation === 0) {
    if (!hasMeaningfulSelectionRotation(editor, previewNodeIds)) {
      return {
        bounds: applyPreviewDeltaToBounds(selectionBounds, previewDelta),
        transform: undefined,
      };
    }

    const orientedFrame = getOrientedSelectionFrame(worldCorners);

    if (!(orientedFrame && Math.abs(orientedFrame.rotation) > 0.1)) {
      return {
        bounds: applyPreviewDeltaToBounds(selectionBounds, previewDelta),
        transform: undefined,
      };
    }

    return {
      bounds: applyPreviewDeltaToBounds(orientedFrame.bounds, previewDelta),
      transform: `rotate(${orientedFrame.rotation}deg)`,
    };
  }

  if (worldCorners.length === 0) {
    return {
      bounds: applyPreviewDeltaToBounds(selectionBounds, previewDelta),
      transform: undefined,
    };
  }

  const unrotatedCorners = worldCorners.map((point) => {
    return rotatePointAround(point, { x: 0, y: 0 }, -sharedRotation);
  });
  const minX = Math.min(...unrotatedCorners.map((point) => point.x));
  const minY = Math.min(...unrotatedCorners.map((point) => point.y));
  const maxX = Math.max(...unrotatedCorners.map((point) => point.x));
  const maxY = Math.max(...unrotatedCorners.map((point) => point.y));
  const width = maxX - minX;
  const height = maxY - minY;
  const worldCenter = rotatePointAround(
    {
      x: minX + width / 2,
      y: minY + height / 2,
    },
    { x: 0, y: 0 },
    sharedRotation
  );

  return {
    bounds: applyPreviewDeltaToBounds(
      {
        height,
        maxX: worldCenter.x + width / 2,
        maxY: worldCenter.y + height / 2,
        minX: worldCenter.x - width / 2,
        minY: worldCenter.y - height / 2,
        width,
      },
      previewDelta
    ),
    transform: `rotate(${sharedRotation}deg)`,
  };
};

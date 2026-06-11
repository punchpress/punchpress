import {
  getLocalBoundsCenter,
  getRotatedNodeUpdate,
  rotatePointAround,
} from "../primitives/rotation";
import { isContainerNode } from "../nodes/node-tree";
import { measurePerf } from "../perf/perf-hooks";
import { PERF_SPANS } from "../perf/perf-labels";
import { round } from "../primitives/math";
import {
  applyMatrixToPoint,
  IDENTITY_MATRIX,
  invertMatrix,
  getMatrixRotation,
  getNodeLocalMatrix,
  multiplyMatrix,
} from "./node-transform-matrix";

const getTransformNumber = (node, key, fallback = 0) => {
  const value = node?.transform?.[key];

  return Number.isFinite(value) ? value : fallback;
};

const getParentWorldMatrix = (editor, node, baseNodes) => {
  const ancestors = [];
  let currentParentId = node?.parentId;

  while (currentParentId && currentParentId !== "root") {
    const parentNode = baseNodes.get(currentParentId) || editor.getNode(currentParentId);

    if (!parentNode) {
      break;
    }

    const parentBounds =
      parentNode.bbox || editor.getNodeTransformBounds(parentNode.id);

    if (!parentBounds) {
      break;
    }

    ancestors.push({ bbox: parentBounds, node: parentNode });
    currentParentId = parentNode.parentId;
  }

  return ancestors.reverse().reduce((matrix, ancestor) => {
    return multiplyMatrix(matrix, getNodeLocalMatrix(ancestor.node, ancestor.bbox));
  }, IDENTITY_MATRIX);
};

const getWorldRotateNodeUpdate = (
  editor,
  baseNode,
  bbox,
  baseNodes,
  selectionCenter,
  deltaRotation
) => {
  const localCenter = getLocalBoundsCenter(bbox);
  const parentMatrix = getParentWorldMatrix(editor, baseNode, baseNodes);
  const nodeCenterInParent = {
    x: getTransformNumber(baseNode, "x") + localCenter.x,
    y: getTransformNumber(baseNode, "y") + localCenter.y,
  };
  const nodeWorldCenter = applyMatrixToPoint(parentMatrix, nodeCenterInParent);
  const nextWorldCenter = rotatePointAround(
    nodeWorldCenter,
    selectionCenter,
    deltaRotation
  );
  const inverseParentMatrix = invertMatrix(parentMatrix);

  if (!inverseParentMatrix) {
    return getRotatedNodeUpdate(baseNode, bbox, selectionCenter, deltaRotation);
  }

  const nextParentCenter = applyMatrixToPoint(
    inverseParentMatrix,
    nextWorldCenter
  );
  const parentRotation = getMatrixRotation(parentMatrix);
  const nodeWorldRotation =
    parentRotation + getTransformNumber(baseNode, "rotation");

  return {
    transform: {
      rotation: round(nodeWorldRotation + deltaRotation - parentRotation, 2),
      x: round(nextParentCenter.x - localCenter.x, 2),
      y: round(nextParentCenter.y - localCenter.y, 2),
    },
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

const getRotateSelectionCenter = (
  editor,
  requestedNodeIds,
  resolvedNodeIds
) => {
  const selectionFrame = editor.getSelectionTransformFrame(requestedNodeIds);
  const frameCenter = getBoundsCenter(selectionFrame?.bounds);

  if (frameCenter) {
    return frameCenter;
  }

  return getBoundsCenter(editor.getSelectionBounds(resolvedNodeIds));
};

export const beginRotateSelection = (editor, { nodeId = undefined, nodeIds = undefined } = {}) => {
  return measurePerf(PERF_SPANS.transformRotateBegin, () =>
    beginRotateSelectionMeasured(editor, { nodeId, nodeIds })
  );
};

const beginRotateSelectionMeasured = (editor, { nodeId = undefined, nodeIds = undefined } = {}) => {
  const requestedNodeIds =
    nodeIds?.filter((currentNodeId) => editor.getNode(currentNodeId)) ||
    (nodeId
      ? [nodeId].filter((currentNodeId) => editor.getNode(currentNodeId))
      : null) ||
    editor.selectedNodeIds;
  const resolvedNodeIds = editor.getEffectiveSelectionNodeIds(requestedNodeIds);
  const includesContainerSelection = requestedNodeIds.some((currentNodeId) => {
    return isContainerNode(editor.getNode(currentNodeId));
  });

  if (
    resolvedNodeIds.length === 0 ||
    requestedNodeIds.some(
      (currentNodeId) => editor.getNodeRotateMode(currentNodeId) === "none"
    )
  ) {
    return null;
  }

  const baseNodes = new Map();

  for (const currentNodeId of resolvedNodeIds) {
    const rotatedNode = editor.getNode(currentNodeId);
    const bbox = rotatedNode
      ? editor.getNodeTransformBounds(currentNodeId) ||
        editor.getNodeFrame(currentNodeId)?.bounds
      : null;

    if (!(rotatedNode && bbox)) {
      continue;
    }

    baseNodes.set(currentNodeId, {
      bbox: { ...bbox },
      ...rotatedNode,
    });
  }

  if (baseNodes.size === 0) {
    return null;
  }

  const selectionCenter = getRotateSelectionCenter(
    editor,
    requestedNodeIds,
    resolvedNodeIds
  );

  if (!selectionCenter) {
    return null;
  }

  if (
    requestedNodeIds.length === 1 &&
    !includesContainerSelection &&
    editor.getNodeRotateMode(requestedNodeIds[0]) === "self"
  ) {
    return {
      baseNodes,
      mode: "live",
      nodeIds: [...resolvedNodeIds],
      selectionCenter,
    };
  }

  return {
    baseNodes,
    mode: "aggregate",
    nodeIds: [...resolvedNodeIds],
    previewDeltaRotation: 0,
    previewNodeIds: requestedNodeIds,
    selectionCenter,
  };
};

export const updateRotateSelection = (
  editor,
  session,
  { deltaRotation = 0, queueRefresh = undefined } = {}
) => {
  return measurePerf(PERF_SPANS.transformRotateUpdate, () => {
    if (!(session && Number.isFinite(deltaRotation))) {
      return [];
    }

    if (session.mode === "aggregate") {
      session.previewDeltaRotation = deltaRotation;
      const previewNodeIds = session.previewNodeIds || session.nodeIds;

      editor.updateNodes(session.nodeIds, (node) => {
        const baseNode = session.baseNodes.get(node.id);

        if (!baseNode) {
          return node;
        }

        return getWorldRotateNodeUpdate(
          editor,
          baseNode,
          baseNode.bbox,
          session.baseNodes,
          session.selectionCenter,
          deltaRotation
        );
      });
      editor.setSelectionDragPreview(null);

      return previewNodeIds;
    }

    editor.updateNodes(session.nodeIds, (node) => {
      const baseNode = session.baseNodes.get(node.id);

      if (!baseNode) {
        return node;
      }

      return getRotatedNodeUpdate(
        baseNode,
        baseNode.bbox,
        session.selectionCenter,
        deltaRotation
      );
    });

    return session.nodeIds;
  });
};

export const commitRotateSelection = (editor, session) => {
  return measurePerf(PERF_SPANS.transformRotateCommit, () => {
    if (!session) {
      editor.setSelectionDragPreview(null);
      return [];
    }

    if (session.mode !== "aggregate") {
      return session.nodeIds || [];
    }

    const deltaRotation = session.previewDeltaRotation || 0;
    editor.setSelectionDragPreview(null);

    if (!Number.isFinite(deltaRotation) || deltaRotation === 0) {
      return [];
    }

    editor.updateNodes(session.nodeIds, (node) => {
      const baseNode = session.baseNodes.get(node.id);

      if (!baseNode) {
        return node;
      }

      return getWorldRotateNodeUpdate(
        editor,
        baseNode,
        baseNode.bbox,
        session.baseNodes,
        session.selectionCenter,
        deltaRotation
      );
    });

    return session.nodeIds;
  });
};

export const rotateSelectionBy = (
  editor,
  { deltaRotation = 0, queueRefresh = true } = {}
) => {
  const selectedNodeIds = editor.selectedNodeIds.filter((nodeId) => {
    return editor.getNode(nodeId);
  });
  const effectiveSelectedNodeIds =
    editor.getEffectiveSelectionNodeIds(selectedNodeIds);

  if (
    !(effectiveSelectedNodeIds.length > 0 && Number.isFinite(deltaRotation))
  ) {
    return [];
  }

  const rotateSession = beginRotateSelection(editor, {
    nodeIds: selectedNodeIds,
  });

  updateRotateSelection(editor, rotateSession, {
    deltaRotation,
    queueRefresh,
  });

  return commitRotateSelection(editor, rotateSession);
};

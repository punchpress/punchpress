import {
  getNodeRotationCenter,
  getRotatedNodeUpdate,
} from "../primitives/rotation";
import { estimateBounds } from "../shapes/warp-text/warp-layout";

const getBoundsCenter = (bounds) => {
  if (!bounds) {
    return null;
  }

  return {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
  };
};

const queueOverlayRefresh = (editor) => {
  if (typeof window === "undefined") {
    editor.onViewportChange?.();
    return;
  }

  window.requestAnimationFrame(() => {
    editor.onViewportChange?.();
  });
};

export const beginRotateSelection = (editor, { nodeId, nodeIds } = {}) => {
  const resolvedNodeIds =
    nodeIds?.filter((currentNodeId) => editor.getNode(currentNodeId)) ||
    (nodeId
      ? [nodeId].filter((currentNodeId) => editor.getNode(currentNodeId))
      : null) ||
    editor.selectedNodeIds;

  if (resolvedNodeIds.length === 0) {
    return null;
  }

  const baseNodes = new Map();

  for (const currentNodeId of resolvedNodeIds) {
    const rotatedNode = editor.getNode(currentNodeId);
    const bbox =
      editor.getNodeGeometry(currentNodeId)?.bbox ||
      (rotatedNode ? estimateBounds(rotatedNode) : null);

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

  const selectionCenter =
    resolvedNodeIds.length === 1
      ? getNodeRotationCenter(
          baseNodes.get(resolvedNodeIds[0]),
          baseNodes.get(resolvedNodeIds[0]).bbox
        )
      : getBoundsCenter(editor.getSelectionBounds(resolvedNodeIds));

  if (!selectionCenter) {
    return null;
  }

  return {
    baseNodes,
    nodeIds: [...resolvedNodeIds],
    selectionCenter,
  };
};

export const updateRotateSelection = (
  editor,
  session,
  { deltaRotation = 0, queueRefresh = false } = {}
) => {
  if (!(session && Number.isFinite(deltaRotation))) {
    return [];
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

  if (queueRefresh) {
    queueOverlayRefresh(editor);
  }

  return session.nodeIds;
};

export const rotateSelectionBy = (
  editor,
  { deltaRotation = 0, queueRefresh = true } = {}
) => {
  if (!(editor.selectedNodeIds.length > 0 && Number.isFinite(deltaRotation))) {
    return [];
  }

  const rotateSession = beginRotateSelection(editor, {
    nodeIds: editor.selectedNodeIds,
  });

  return updateRotateSelection(editor, rotateSession, {
    deltaRotation,
    queueRefresh,
  });
};

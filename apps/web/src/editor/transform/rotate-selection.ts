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

export const beginRotateNode = (editor, { nodeId } = {}) => {
  const rotatedNode = editor.getNode(nodeId || editor.selectedNode?.id);
  const bbox =
    editor.getNodeGeometry(rotatedNode?.id)?.bbox ||
    (rotatedNode ? estimateBounds(rotatedNode) : null);

  if (!(rotatedNode && bbox)) {
    return null;
  }

  return {
    baseBBox: { ...bbox },
    baseNode: { ...rotatedNode },
    nodeId: rotatedNode.id,
    selectionCenter: getNodeRotationCenter(rotatedNode, bbox),
  };
};

export const updateRotateNode = (
  editor,
  session,
  { deltaRotation = 0, queueRefresh = false } = {}
) => {
  if (!(session && Number.isFinite(deltaRotation))) {
    return null;
  }

  editor.updateNode(
    session.nodeId,
    getRotatedNodeUpdate(
      session.baseNode,
      session.baseBBox,
      session.selectionCenter,
      deltaRotation
    )
  );

  if (queueRefresh) {
    queueOverlayRefresh(editor);
  }

  return session.nodeId;
};

export const beginRotateGroup = (editor, { nodeIds } = {}) => {
  const rotatedNodeIds =
    nodeIds?.filter((nodeId) => editor.getNode(nodeId)) ||
    editor.selectedNodeIds;

  if (rotatedNodeIds.length === 0) {
    return null;
  }

  const selectionBounds = editor.getSelectionBounds(rotatedNodeIds);
  const selectionCenter = getBoundsCenter(selectionBounds);

  if (!selectionCenter) {
    return null;
  }

  const baseNodes = new Map();

  for (const nodeId of rotatedNodeIds) {
    const rotatedNode = editor.getNode(nodeId);
    const bbox =
      editor.getNodeGeometry(nodeId)?.bbox ||
      (rotatedNode ? estimateBounds(rotatedNode) : null);

    if (!(rotatedNode && bbox)) {
      continue;
    }

    baseNodes.set(nodeId, {
      bbox: { ...bbox },
      ...rotatedNode,
    });
  }

  if (baseNodes.size === 0) {
    return null;
  }

  return {
    baseNodes,
    nodeIds: [...rotatedNodeIds],
    selectionCenter,
  };
};

export const updateRotateGroup = (
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

  if (editor.selectedNodeIds.length === 1) {
    const rotateSession = beginRotateNode(editor, {
      nodeId: editor.selectedNodeIds[0],
    });
    const rotatedNodeId = updateRotateNode(editor, rotateSession, {
      deltaRotation,
      queueRefresh,
    });

    return rotatedNodeId ? [rotatedNodeId] : [];
  }

  const rotateSession = beginRotateGroup(editor, {
    nodeIds: editor.selectedNodeIds,
  });

  return updateRotateGroup(editor, rotateSession, {
    deltaRotation,
    queueRefresh,
  });
};

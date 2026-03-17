import { round } from "../primitives/math";
import { getNodeX, getNodeY } from "../shapes/warp-text/model";
import { estimateBounds } from "../shapes/warp-text/warp-layout";

const queueOverlayRefresh = (editor) => {
  if (typeof window === "undefined") {
    editor.onViewportChange?.();
    return;
  }

  window.requestAnimationFrame(() => {
    editor.onViewportChange?.();
  });
};

export const beginMoveSelection = (editor, { nodeId, nodeIds } = {}) => {
  const requestedNodeIds =
    nodeIds?.filter((currentNodeId) => editor.getNode(currentNodeId)) ||
    (nodeId
      ? [nodeId].filter((currentNodeId) => editor.getNode(currentNodeId))
      : null) ||
    editor.selectedNodeIds;
  const resolvedNodeIds = editor.getEffectiveSelectionNodeIds(requestedNodeIds);

  if (resolvedNodeIds.length === 0) {
    return null;
  }

  const baseBBoxes = new Map();

  for (const currentNodeId of resolvedNodeIds) {
    const movedNode = editor.getNode(currentNodeId);
    const bbox =
      editor.getNodeGeometry(currentNodeId)?.bbox ||
      (movedNode ? estimateBounds(movedNode) : null);

    if (!bbox) {
      continue;
    }

    baseBBoxes.set(currentNodeId, { ...bbox });
  }

  if (baseBBoxes.size === 0) {
    return null;
  }

  return {
    baseBBoxes,
    nodeIds: [...resolvedNodeIds],
  };
};

export const updateMoveSelection = (
  editor,
  session,
  { dragEvents, left, queueRefresh = false, top } = {}
) => {
  if (!session) {
    return [];
  }

  if (
    session.nodeIds.length === 1 &&
    Number.isFinite(left) &&
    Number.isFinite(top)
  ) {
    const nodeId = session.nodeIds[0];
    const bbox = session.baseBBoxes.get(nodeId);

    if (!bbox) {
      return [];
    }

    editor.updateNode(nodeId, {
      transform: {
        x: round(left - bbox.minX, 2),
        y: round(top - bbox.minY, 2),
      },
    });

    if (queueRefresh) {
      queueOverlayRefresh(editor);
    }

    return [nodeId];
  }

  if (!(dragEvents?.length > 0)) {
    return [];
  }

  editor.updateNodes(session.nodeIds, (node) => {
    const dragEvent = dragEvents.find(
      (item) => item.target?.dataset.nodeId === node.id
    );
    const bbox = session.baseBBoxes.get(node.id);

    if (!(dragEvent && bbox)) {
      return node;
    }

    return {
      transform: {
        x: round(dragEvent.left - bbox.minX, 2),
        y: round(dragEvent.top - bbox.minY, 2),
      },
    };
  });

  if (queueRefresh) {
    queueOverlayRefresh(editor);
  }

  return session.nodeIds;
};

export const moveSelectionBy = (
  editor,
  { queueRefresh = false, x = 0, y = 0 } = {}
) => {
  const effectiveSelectedNodeIds = editor.getEffectiveSelectionNodeIds();

  if (effectiveSelectedNodeIds.length === 0) {
    return [];
  }

  editor.updateNodes(effectiveSelectedNodeIds, (node) => ({
    transform: {
      x: round(getNodeX(node) + x, 2),
      y: round(getNodeY(node) + y, 2),
    },
  }));

  if (queueRefresh) {
    queueOverlayRefresh(editor);
  }

  return effectiveSelectedNodeIds;
};

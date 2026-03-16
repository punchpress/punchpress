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

export const createNodeDragSession = (editor, { nodeId } = {}) => {
  const draggedNode = editor.getNode(nodeId || editor.selectedNode?.id);
  const bbox =
    editor.getNodeGeometry(draggedNode?.id)?.bbox ||
    (draggedNode ? estimateBounds(draggedNode) : null);

  if (!(draggedNode && bbox)) {
    return null;
  }

  return {
    baseBBox: { ...bbox },
    nodeId: draggedNode.id,
  };
};

export const updateNodeDragSession = (
  editor,
  session,
  { left, queueRefresh = false, top } = {}
) => {
  if (!(session && Number.isFinite(left) && Number.isFinite(top))) {
    return null;
  }

  editor.updateNode(session.nodeId, {
    transform: {
      x: round(left - session.baseBBox.minX, 2),
      y: round(top - session.baseBBox.minY, 2),
    },
  });

  if (queueRefresh) {
    queueOverlayRefresh(editor);
  }

  return session.nodeId;
};

export const createGroupDragSession = (editor, { nodeIds } = {}) => {
  const draggedNodeIds =
    nodeIds?.filter((nodeId) => editor.getNode(nodeId)) ||
    editor.selectedNodeIds;

  if (draggedNodeIds.length === 0) {
    return null;
  }

  const baseBBoxes = new Map();

  for (const nodeId of draggedNodeIds) {
    const draggedNode = editor.getNode(nodeId);
    const bbox =
      editor.getNodeGeometry(nodeId)?.bbox ||
      (draggedNode ? estimateBounds(draggedNode) : null);

    if (!bbox) {
      continue;
    }

    baseBBoxes.set(nodeId, { ...bbox });
  }

  if (baseBBoxes.size === 0) {
    return null;
  }

  return {
    baseBBoxes,
    nodeIds: [...draggedNodeIds],
  };
};

export const updateGroupDragSession = (
  editor,
  session,
  { dragEvents, queueRefresh = false } = {}
) => {
  if (!(session && dragEvents?.length > 0)) {
    return [];
  }

  editor.updateNodes(session.nodeIds, (node) => {
    const groupEvent = dragEvents.find(
      (item) => item.target?.dataset.nodeId === node.id
    );
    const bbox = session.baseBBoxes.get(node.id);

    if (!(groupEvent && bbox)) {
      return node;
    }

    return {
      transform: {
        x: round(groupEvent.left - bbox.minX, 2),
        y: round(groupEvent.top - bbox.minY, 2),
      },
    };
  });

  if (queueRefresh) {
    queueOverlayRefresh(editor);
  }

  return session.nodeIds;
};

export const moveSelectedNodesBy = (
  editor,
  { queueRefresh = false, x = 0, y = 0 } = {}
) => {
  if (editor.selectedNodeIds.length === 0) {
    return [];
  }

  editor.updateNodes(editor.selectedNodeIds, (node) => ({
    transform: {
      x: round(getNodeX(node) + x, 2),
      y: round(getNodeY(node) + y, 2),
    },
  }));

  if (queueRefresh) {
    queueOverlayRefresh(editor);
  }

  return editor.selectedNodeIds;
};

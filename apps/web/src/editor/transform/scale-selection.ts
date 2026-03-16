import {
  getCornerPointFromBounds,
  getResizeAnchorFromBounds,
  getResizeCorner,
  getResizedNodeUpdate,
  getScaledGroupNodeUpdate,
} from "../primitives/group-resize";
import { getNodeWorldPoint } from "../primitives/rotation";
import { estimateBounds } from "../shapes/warp-text/warp-layout";

const CORNER_DIRECTION = {
  ne: [1, -1],
  nw: [-1, -1],
  se: [1, 1],
  sw: [-1, 1],
} as const;

export const createNodeResizeSession = (
  editor,
  { anchorCanvas, direction, nodeId } = {}
) => {
  const selectedNode = editor.getNode(nodeId || editor.selectedNode?.id);
  const geometry = editor.getNodeGeometry(selectedNode?.id);
  const bbox =
    geometry?.bbox || (selectedNode ? estimateBounds(selectedNode) : null);

  if (!(selectedNode && bbox && direction && anchorCanvas)) {
    return null;
  }

  return {
    anchorCanvas: { ...anchorCanvas },
    baseBBox: { ...bbox },
    baseNode: { ...selectedNode },
    direction: [...direction],
    nodeId: selectedNode.id,
  };
};

export const updateNodeResizeSession = (
  editor,
  session,
  { queueRefresh = false, scale = 1 } = {}
) => {
  if (!(session && Number.isFinite(scale))) {
    return null;
  }

  editor.updateNode(
    session.nodeId,
    getResizedNodeUpdate(
      session.baseNode,
      session.baseBBox,
      session.anchorCanvas,
      scale,
      session.direction
    )
  );

  if (queueRefresh) {
    queueOverlayRefresh(editor);
  }

  return session.nodeId;
};

export const createGroupResizeSession = (
  editor,
  { anchorCanvas, nodeIds } = {}
) => {
  const resizeNodeIds =
    nodeIds?.filter((nodeId) => editor.getNode(nodeId)) ||
    editor.selectedNodeIds;

  if (!(resizeNodeIds.length > 0 && anchorCanvas)) {
    return null;
  }

  return {
    anchorCanvas: { ...anchorCanvas },
    baseNodes: new Map(
      resizeNodeIds.map((nodeId) => [nodeId, { ...editor.getNode(nodeId) }])
    ),
    nodeIds: [...resizeNodeIds],
  };
};

export const updateGroupResizeSession = (
  editor,
  session,
  { queueRefresh = false, scale = 1 } = {}
) => {
  if (!(session && Number.isFinite(scale))) {
    return [];
  }

  editor.updateNodes(session.nodeIds, (node) => {
    const baseNode = session.baseNodes.get(node.id);

    if (!baseNode) {
      return node;
    }

    return getScaledGroupNodeUpdate(baseNode, session.anchorCanvas, scale);
  });

  if (queueRefresh) {
    queueOverlayRefresh(editor);
  }

  return session.nodeIds;
};

export const scaleSelectedNodeFromCorner = (
  editor,
  { corner = "se", scale = 1 } = {}
) => {
  const selectedNode = editor.selectedNode;
  const geometry = editor.getNodeGeometry(selectedNode?.id);
  const bbox =
    geometry?.bbox || (selectedNode ? estimateBounds(selectedNode) : null);
  const direction = CORNER_DIRECTION[corner];

  if (!(selectedNode && bbox && direction)) {
    return null;
  }

  const resizeSession = createNodeResizeSession(editor, {
    anchorCanvas: getNodeWorldPoint(
      selectedNode,
      bbox,
      getCornerPointFromBounds(bbox, getResizeCorner(direction, true))
    ),
    direction,
    nodeId: selectedNode.id,
  });

  return updateNodeResizeSession(editor, resizeSession, {
    queueRefresh: true,
    scale,
  });
};

export const scaleSelectedGroupFromCorner = (
  editor,
  { corner = "sw", scale = 1 } = {}
) => {
  const selectionBounds = editor.getSelectionBounds(editor.selectedNodeIds);
  const direction = CORNER_DIRECTION[corner];

  if (!(selectionBounds && direction)) {
    return [];
  }

  const resizeSession = createGroupResizeSession(editor, {
    anchorCanvas: getResizeAnchorFromBounds(selectionBounds, direction),
    nodeIds: editor.selectedNodeIds,
  });

  return updateGroupResizeSession(editor, resizeSession, {
    queueRefresh: true,
    scale,
  });
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

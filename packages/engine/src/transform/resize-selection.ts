import {
  getCornerPointFromBounds,
  getResizeAnchorFromBounds,
  getResizeCorner,
  getResizedNodeUpdate,
  getScaledGroupNodeUpdate,
} from "../primitives/group-resize";
import { getNodeWorldPoint } from "../primitives/rotation";

const CORNER_DIRECTION = {
  ne: [1, -1],
  nw: [-1, -1],
  se: [1, 1],
  sw: [-1, 1],
} as const;

export const beginResizeSelection = (
  editor,
  { anchorCanvas, direction, nodeId, nodeIds } = {}
) => {
  const requestedNodeIds =
    nodeIds?.filter((currentNodeId) => editor.getNode(currentNodeId)) ||
    (nodeId
      ? [nodeId].filter((currentNodeId) => editor.getNode(currentNodeId))
      : null) ||
    editor.selectedNodeIds;
  const resolvedNodeIds = editor.getEffectiveSelectionNodeIds(requestedNodeIds);

  if (!(resolvedNodeIds.length > 0 && anchorCanvas)) {
    return null;
  }

  if (resolvedNodeIds.length === 1) {
    const resolvedNodeId = resolvedNodeIds[0];
    const resizedNode = editor.getNode(resolvedNodeId);
    const bbox = resizedNode
      ? editor.getNodeTransformBounds(resolvedNodeId)
      : null;

    if (!(resizedNode && bbox && direction)) {
      return null;
    }

    return {
      anchorCanvas: { ...anchorCanvas },
      baseBBox: { ...bbox },
      baseNode: { ...resizedNode },
      direction: [...direction],
      nodeIds: [resolvedNodeId],
    };
  }

  return {
    anchorCanvas: { ...anchorCanvas },
    baseNodes: new Map(
      resolvedNodeIds.map((resolvedNodeId) => [
        resolvedNodeId,
        { ...editor.getNode(resolvedNodeId) },
      ])
    ),
    nodeIds: [...resolvedNodeIds],
  };
};

export const updateResizeSelection = (editor, session, { scale = 1 } = {}) => {
  if (!(session && Number.isFinite(scale))) {
    return [];
  }

  if ("direction" in session) {
    const nodeId = session.nodeIds[0];

    editor.updateNode(
      nodeId,
      getResizedNodeUpdate(
        session.baseNode,
        session.baseBBox,
        session.anchorCanvas,
        scale,
        session.direction
      )
    );

    return [nodeId];
  }

  editor.updateNodes(session.nodeIds, (node) => {
    const baseNode = session.baseNodes.get(node.id);

    if (!baseNode) {
      return node;
    }

    return getScaledGroupNodeUpdate(baseNode, session.anchorCanvas, scale);
  });

  return session.nodeIds;
};

export const resizeSelectionFromCorner = (
  editor,
  { corner = "se", scale = 1 } = {}
) => {
  const effectiveSelectedNodeIds = editor.getEffectiveSelectionNodeIds();

  if (effectiveSelectedNodeIds.length === 0) {
    return [];
  }

  const direction = CORNER_DIRECTION[corner];

  if (!direction) {
    return [];
  }

  if (effectiveSelectedNodeIds.length === 1) {
    const selectedNode = editor.getNode(effectiveSelectedNodeIds[0]);
    const bbox = selectedNode?.id
      ? editor.getNodeTransformBounds(selectedNode.id)
      : null;

    if (!(selectedNode && bbox)) {
      return [];
    }

    const resizeSession = beginResizeSelection(editor, {
      anchorCanvas: getNodeWorldPoint(
        selectedNode,
        bbox,
        getCornerPointFromBounds(bbox, getResizeCorner(direction, true))
      ),
      direction,
      nodeId: selectedNode.id,
    });

    return updateResizeSelection(editor, resizeSession, {
      queueRefresh: true,
      scale,
    });
  }

  const selectionNodeIds =
    effectiveSelectedNodeIds.length > 0
      ? effectiveSelectedNodeIds
      : editor.selectedNodeIds;
  const effectiveSelectionBounds = editor.getSelectionBounds(selectionNodeIds);

  if (!effectiveSelectionBounds) {
    return [];
  }

  const resizeSession = beginResizeSelection(editor, {
    anchorCanvas: getResizeAnchorFromBounds(
      effectiveSelectionBounds,
      direction
    ),
    nodeIds: effectiveSelectedNodeIds,
  });

  return updateResizeSelection(editor, resizeSession, {
    queueRefresh: true,
    scale,
  });
};

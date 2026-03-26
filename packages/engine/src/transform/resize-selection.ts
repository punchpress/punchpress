import {
  getCornerPointFromBounds,
  getResizeAnchorFromBounds,
  getResizeCorner,
  getResizedNodeUpdate,
  getScaledGroupNodeUpdate,
} from "../primitives/group-resize";
import { getNodeWorldPoint } from "../primitives/rotation";
import { getResizedShapeNodeUpdate } from "../primitives/shape-resize";

const CORNER_DIRECTION = {
  ne: [1, -1],
  nw: [-1, -1],
  se: [1, 1],
  sw: [-1, 1],
} as const;

export const beginResizeSelection = (
  editor,
  { anchorCanvas, direction, handle, nodeId, nodeIds } = {}
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

    if (
      !(
        resizedNode &&
        bbox &&
        (direction || (resizedNode.type === "shape" && handle))
      )
    ) {
      return null;
    }

    if (resizedNode.type === "shape" && handle) {
      return {
        anchorCanvas: { ...anchorCanvas },
        baseBBox: { ...bbox },
        baseNode: { ...resizedNode },
        handle,
        mode: "shape-box",
        nodeIds: [resolvedNodeId],
      };
    }

    return {
      anchorCanvas: { ...anchorCanvas },
      baseBBox: { ...bbox },
      baseNode: { ...resizedNode },
      direction: [...direction],
      nodeIds: [resolvedNodeId],
      pathEditing: editor.isPathEditing(resolvedNodeId),
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

export const updateResizeSelection = (
  editor,
  session,
  { pointCanvas, preserveAspectRatio = false, scale = 1 } = {}
) => {
  if (!session) {
    return [];
  }

  if (session.mode === "shape-box") {
    const nodeId = session.nodeIds[0];
    const nodeUpdate = getResizedShapeNodeUpdate(
      session.baseNode,
      session.baseBBox,
      session.anchorCanvas,
      pointCanvas,
      session.handle,
      { preserveAspectRatio }
    );

    if (!nodeUpdate) {
      return [];
    }

    editor.updateNode(nodeId, nodeUpdate);
    return [nodeId];
  }

  if ("direction" in session) {
    if (!Number.isFinite(scale)) {
      return [];
    }

    const nodeId = session.nodeIds[0];

    editor.updateNode(
      nodeId,
      session.pathEditing
        ? getScaledGroupNodeUpdate(
            session.baseNode,
            session.anchorCanvas,
            scale
          )
        : getResizedNodeUpdate(
            session.baseNode,
            session.baseBBox,
            session.anchorCanvas,
            scale,
            session.direction
          )
    );

    return [nodeId];
  }

  if (!Number.isFinite(scale)) {
    return [];
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

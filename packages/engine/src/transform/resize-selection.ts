import { isArtboardNode, isContainerNode } from "../nodes/node-tree";
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

const getResizedArtboardNodeUpdate = (node, bbox, pointCanvas, handle) => {
  if (!(node && bbox && pointCanvas && handle)) {
    return null;
  }

  let minX = bbox.minX;
  let maxX = bbox.maxX;
  let minY = bbox.minY;
  let maxY = bbox.maxY;

  if (handle.endsWith("w")) {
    minX = Math.min(pointCanvas.x, bbox.maxX - 1);
  } else if (handle.endsWith("e")) {
    maxX = Math.max(pointCanvas.x, bbox.minX + 1);
  }

  if (handle.startsWith("n")) {
    minY = Math.min(pointCanvas.y, bbox.maxY - 1);
  } else if (handle.startsWith("s")) {
    maxY = Math.max(pointCanvas.y, bbox.minY + 1);
  }

  return {
    height: Math.round((maxY - minY) * 100) / 100,
    transform: {
      x: Math.round(minX * 100) / 100,
      y: Math.round(minY * 100) / 100,
    },
    width: Math.round((maxX - minX) * 100) / 100,
  };
};

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
  const includesContainerSelection = requestedNodeIds.some((currentNodeId) => {
    return isContainerNode(editor.getNode(currentNodeId));
  });

  if (!(resolvedNodeIds.length > 0 && anchorCanvas)) {
    return null;
  }

  if (
    requestedNodeIds.length === 1 &&
    isArtboardNode(editor.getNode(requestedNodeIds[0])) &&
    handle
  ) {
    const artboardNode = editor.getNode(requestedNodeIds[0]);
    const bbox = artboardNode
      ? editor.getNodeTransformFrame(artboardNode.id)?.bounds
      : null;

    if (!(artboardNode && bbox)) {
      return null;
    }

    return {
      baseBBox: { ...bbox },
      baseNode: { ...artboardNode },
      handle,
      mode: "artboard-box",
      nodeIds: [artboardNode.id],
    };
  }

  if (resolvedNodeIds.length === 1 && !includesContainerSelection) {
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
      resolvedNodeIds.flatMap((resolvedNodeId) => {
        const baseNode = editor.getNode(resolvedNodeId);
        const bbox = baseNode
          ? editor.getNodeTransformBounds(resolvedNodeId)
          : null;

        if (!(baseNode && bbox)) {
          return [];
        }

        return [[resolvedNodeId, { ...baseNode, bbox }]];
      })
    ),
    nodeIds: resolvedNodeIds.filter((resolvedNodeId) => {
      return editor.getNodeTransformBounds(resolvedNodeId);
    }),
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

  if (session.mode === "artboard-box") {
    const nodeId = session.nodeIds[0];
    const nodeUpdate = getResizedArtboardNodeUpdate(
      session.baseNode,
      session.baseBBox,
      pointCanvas,
      session.handle
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
            session.baseBBox,
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

    return getScaledGroupNodeUpdate(
      baseNode,
      baseNode.bbox,
      session.anchorCanvas,
      scale
    );
  });

  return session.nodeIds;
};

export const resizeSelectionFromCorner = (
  editor,
  { corner = "se", scale = 1 } = {}
) => {
  const requestedSelectedNodeIds = editor.selectedNodeIds.filter((nodeId) => {
    return editor.getNode(nodeId);
  });
  const effectiveSelectedNodeIds = editor.getEffectiveSelectionNodeIds();
  const includesContainerSelection = requestedSelectedNodeIds.some((nodeId) => {
    return isContainerNode(editor.getNode(nodeId));
  });

  if (effectiveSelectedNodeIds.length === 0) {
    return [];
  }

  const direction = CORNER_DIRECTION[corner];

  if (!direction) {
    return [];
  }

  if (effectiveSelectedNodeIds.length === 1 && !includesContainerSelection) {
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
    nodeIds:
      requestedSelectedNodeIds.length > 0
        ? requestedSelectedNodeIds
        : effectiveSelectedNodeIds,
  });

  return updateResizeSelection(editor, resizeSession, {
    queueRefresh: true,
    scale,
  });
};

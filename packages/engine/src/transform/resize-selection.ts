import { isArtboardNode, isContainerNode } from "../nodes/node-tree";
import {
  buildNodeCapabilityGeometry,
  getNodeFrameFromGeometry,
} from "../nodes/node-capabilities";
import { measurePerf } from "../perf/perf-hooks";
import {
  getCornerPointFromBounds,
  getResizeAnchorFromBounds,
  getResizeCorner,
  getResizedNodeUpdate,
  getScaledGroupNodeUpdate,
  getScaledPathEditingNodeUpdate,
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

const getArtboardBoxResizeSession = (editor, requestedNodeIds, handle) => {
  if (
    !(
      requestedNodeIds.length === 1 &&
      isArtboardNode(editor.getNode(requestedNodeIds[0])) &&
      editor.getNodeResizeMode(requestedNodeIds[0]) === "bounds" &&
      handle
    )
  ) {
    return undefined;
  }

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
};

const getSingleNodeResizeSession = (
  editor,
  { anchorCanvas, direction, handle, includesContainerSelection, nodeIds }
) => {
  if (!(nodeIds.length === 1 && !includesContainerSelection)) {
    return undefined;
  }

  const resizedNodeId = nodeIds[0];
  const resizedNode = editor.getNode(resizedNodeId);
  const bbox = resizedNode
    ? editor.getNodeTransformBounds(resizedNodeId)
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

  const resizeMode = editor.getNodeResizeMode(resizedNodeId);

  if (resizeMode === "bounds" && resizedNode.type === "shape" && handle) {
    return {
      anchorCanvas: { ...anchorCanvas },
      baseBBox: { ...bbox },
      baseNode: { ...resizedNode },
      handle,
      mode: "shape-box",
      nodeIds: [resizedNodeId],
    };
  }

  if (
    !(
      resizeMode === "scale" ||
      (resizeMode === "bounds" && resizedNode.type === "shape" && direction)
    )
  ) {
    return null;
  }

  return {
    anchorCanvas: { ...anchorCanvas },
    baseBBox: { ...bbox },
    baseNode: { ...resizedNode },
    direction: [...direction],
    nodeIds: [resizedNodeId],
    pathEditing: editor.isPathEditing(resizedNodeId),
  };
};

const isAggregateResizeSession = (session) => {
  return Boolean(session?.baseNodes);
};

const mergeNodeUpdate = (node, nodeUpdate) => {
  return {
    ...node,
    ...nodeUpdate,
    transform: {
      ...node.transform,
      ...(nodeUpdate?.transform || {}),
    },
  };
};

const getShapeBoxResizePreview = (baseNode, nodeUpdate) => {
  if (!(baseNode && nodeUpdate)) {
    return null;
  }

  const previewNode = mergeNodeUpdate(baseNode, nodeUpdate);
  const geometry = buildNodeCapabilityGeometry(previewNode);

  return {
    renderFrame: getNodeFrameFromGeometry(previewNode, geometry, "render"),
    transformFrame: getNodeFrameFromGeometry(previewNode, geometry, "transform"),
  };
};

const setShapeBoxResizePreview = (editor, session, nodeUpdate) => {
  const nodeId = session?.nodeIds?.[0];
  const frames = getShapeBoxResizePreview(session?.baseNode, nodeUpdate);

  if (!(nodeId && frames?.renderFrame && frames?.transformFrame)) {
    return [];
  }

  session.previewNodeUpdate = nodeUpdate;
  editor.setSelectionDragPreview({
    effectiveNodeIdSet: new Set([nodeId]),
    nodeIdSet: new Set([nodeId]),
    nodeIds: [nodeId],
    resize: {
      frame: frames.renderFrame,
      nodeUpdate,
      transformFrame: frames.transformFrame,
    },
  });

  return [nodeId];
};

const setResizeSelectionPreview = (editor, session, scale) => {
  if (!(isAggregateResizeSession(session) && Number.isFinite(scale))) {
    return [];
  }

  session.previewScale = scale;
  const previewNodeIds = session.previewNodeIds || session.nodeIds;
  editor.setSelectionDragPreview({
    effectiveNodeIdSet: new Set(session.nodeIds),
    nodeIdSet: new Set([...session.nodeIds, ...previewNodeIds]),
    nodeIds: previewNodeIds,
    resize: {
      anchorCanvas: { ...session.anchorCanvas },
      scale,
    },
  });

  return previewNodeIds;
};

export const beginResizeSelection = (
  editor,
  { anchorCanvas, direction, handle, nodeId, nodeIds } = {}
) => {
  return measurePerf("selection.resize.begin", () =>
    beginResizeSelectionMeasured(editor, {
      anchorCanvas,
      direction,
      handle,
      nodeId,
      nodeIds,
    })
  );
};

const beginResizeSelectionMeasured = (
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

  const artboardSession = getArtboardBoxResizeSession(
    editor,
    requestedNodeIds,
    handle
  );

  if (artboardSession !== undefined) {
    return artboardSession;
  }

  const singleNodeSession = getSingleNodeResizeSession(editor, {
    anchorCanvas,
    direction,
    handle,
    includesContainerSelection,
    nodeIds: resolvedNodeIds,
  });

  if (singleNodeSession !== undefined) {
    return singleNodeSession;
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
    previewNodeIds: requestedNodeIds,
    previewScale: 1,
  };
};

export const updateResizeSelection = (
  editor,
  session,
  { pointCanvas, preserveAspectRatio = false, preview = false, scale = 1 } = {}
) => {
  return measurePerf("selection.resize.update", () =>
    updateResizeSelectionMeasured(editor, session, {
      pointCanvas,
      preserveAspectRatio,
      preview,
      scale,
    })
  );
};

const updateResizeSelectionMeasured = (
  editor,
  session,
  { pointCanvas, preserveAspectRatio = false, preview = false, scale = 1 } = {}
) => {
  if (!session) {
    return [];
  }

  if (session.mode === "shape-box") {
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

    if (preview) {
      return setShapeBoxResizePreview(editor, session, nodeUpdate);
    }

    editor.updateNode(session.nodeIds[0], nodeUpdate);
    return session.nodeIds;
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
        ? getScaledPathEditingNodeUpdate(
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

  if (isAggregateResizeSession(session)) {
    return setResizeSelectionPreview(editor, session, scale);
  }

  return [];
};

export const commitResizeSelection = (editor, session) => {
  return measurePerf("selection.resize.commit", () => {
    if (session?.mode === "shape-box") {
      const nodeId = session.nodeIds?.[0];
      const nodeUpdate = session.previewNodeUpdate;

      editor.setSelectionDragPreview(null);

      if (!(nodeId && nodeUpdate)) {
        return [];
      }

      editor.updateNode(nodeId, nodeUpdate);
      return [nodeId];
    }

    if (!isAggregateResizeSession(session)) {
      editor.setSelectionDragPreview(null);
      return [];
    }

    const scale = session.previewScale;
    editor.setSelectionDragPreview(null);

    if (!Number.isFinite(scale) || scale === 1) {
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
  });
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

  updateResizeSelection(editor, resizeSession, {
    queueRefresh: true,
    scale,
  });

  return commitResizeSelection(editor, resizeSession);
};

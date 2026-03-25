import {
  getNodeRotationCenter,
  getRotatedNodeUpdate,
} from "../primitives/rotation";

const getBoundsCenter = (bounds) => {
  if (!bounds) {
    return null;
  }

  return {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
  };
};

export const beginRotateSelection = (editor, { nodeId, nodeIds } = {}) => {
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

  const baseNodes = new Map();

  for (const currentNodeId of resolvedNodeIds) {
    const rotatedNode = editor.getNode(currentNodeId);
    const bbox = rotatedNode
      ? editor.getNodeTransformBounds(currentNodeId)
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
  { deltaRotation = 0 } = {}
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

  return session.nodeIds;
};

export const rotateSelectionBy = (
  editor,
  { deltaRotation = 0, queueRefresh = true } = {}
) => {
  const effectiveSelectedNodeIds = editor.getEffectiveSelectionNodeIds();

  if (
    !(effectiveSelectedNodeIds.length > 0 && Number.isFinite(deltaRotation))
  ) {
    return [];
  }

  const rotateSession = beginRotateSelection(editor, {
    nodeIds: effectiveSelectedNodeIds,
  });

  return updateRotateSelection(editor, rotateSession, {
    deltaRotation,
    queueRefresh,
  });
};

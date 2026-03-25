import { getNodeX, getNodeY } from "../nodes/text/model";
import { measurePerf } from "../perf/perf-hooks";
import { round } from "../primitives/math";

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
  const baseTransforms = new Map();

  for (const currentNodeId of resolvedNodeIds) {
    const movedNode = editor.getNode(currentNodeId);
    const bbox = editor.getNodeRenderBounds(currentNodeId);

    if (!(bbox && movedNode)) {
      continue;
    }

    baseBBoxes.set(currentNodeId, { ...bbox });
    baseTransforms.set(currentNodeId, {
      x: getNodeX(movedNode),
      y: getNodeY(movedNode),
    });
  }

  if (baseBBoxes.size === 0) {
    return null;
  }

  return {
    baseBBoxes,
    baseTransforms,
    nodeIds: [...resolvedNodeIds],
    previewDelta: { x: 0, y: 0 },
  };
};

const setMoveSelectionPreview = (editor, session, nextDelta) => {
  if (!session) {
    return [];
  }

  const resolvedDelta = {
    x: round(nextDelta.x, 2),
    y: round(nextDelta.y, 2),
  };

  session.previewDelta = resolvedDelta;
  editor.setSelectionDragPreview({
    delta: resolvedDelta,
    nodeIds: session.nodeIds,
  });

  return session.nodeIds;
};

const getAbsoluteMoveDelta = (session, { dragEvents, left, top } = {}) => {
  if (!session) {
    return null;
  }

  if (
    session.nodeIds.length === 1 &&
    Number.isFinite(left) &&
    Number.isFinite(top)
  ) {
    const nodeId = session.nodeIds[0];
    const bbox = session.baseBBoxes.get(nodeId);
    const transform = session.baseTransforms.get(nodeId);

    if (!(bbox && transform)) {
      return null;
    }

    return {
      x: left - bbox.minX - transform.x,
      y: top - bbox.minY - transform.y,
    };
  }

  if (!(dragEvents?.length > 0)) {
    return null;
  }

  const firstNodeId = session.nodeIds[0];
  const firstDragEvent =
    dragEvents.find((item) => item.target?.dataset.nodeId === firstNodeId) ||
    dragEvents[0];
  const bbox = session.baseBBoxes.get(firstNodeId);
  const transform = session.baseTransforms.get(firstNodeId);

  if (!(firstDragEvent && bbox && transform)) {
    return null;
  }

  return {
    x: firstDragEvent.left - bbox.minX - transform.x,
    y: firstDragEvent.top - bbox.minY - transform.y,
  };
};

export const commitMoveSelection = (editor, session) => {
  if (!session) {
    return [];
  }

  const previewDelta = session.previewDelta;

  editor.setSelectionDragPreview(null);

  if (!(previewDelta && (previewDelta.x || previewDelta.y))) {
    return [];
  }

  editor.updateNodes(session.nodeIds, (node) => {
    const baseTransform = session.baseTransforms.get(node.id);

    if (!baseTransform) {
      return node;
    }

    return {
      transform: {
        x: round(baseTransform.x + previewDelta.x, 2),
        y: round(baseTransform.y + previewDelta.y, 2),
      },
    };
  });

  return session.nodeIds;
};

export const updateMoveSelection = (
  editor,
  session,
  { delta, dragEvents, left, top } = {}
) => {
  return measurePerf("selection.move.absolute", () => {
    if (!session) {
      return [];
    }

    if (delta) {
      return setMoveSelectionPreview(editor, session, {
        x: session.previewDelta.x + delta.x,
        y: session.previewDelta.y + delta.y,
      });
    }

    const absoluteDelta = getAbsoluteMoveDelta(session, {
      dragEvents,
      left,
      top,
    });

    if (!absoluteDelta) {
      return [];
    }

    return setMoveSelectionPreview(editor, session, absoluteDelta);
  });
};

export const moveSelectionBy = (editor, { x = 0, y = 0 } = {}) => {
  return measurePerf("selection.move.by", () => {
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

    return effectiveSelectedNodeIds;
  });
};

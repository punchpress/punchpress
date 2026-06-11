import { getTopmostArtboardAtPoint } from "../nodes/artboard/artboard-hit-test";
import { getDescendantLeafNodeIds, isArtboardNode } from "../nodes/node-tree";
import { getNodeX, getNodeY } from "../nodes/text/model";
import { measurePerf } from "../perf/perf-hooks";
import { PERF_SPANS } from "../perf/perf-labels";
import { round } from "../primitives/math";

export const beginMoveSelection = (editor, { nodeId = undefined, nodeIds = undefined } = {}) => {
  const requestedNodeIds =
    nodeIds?.filter((currentNodeId) => editor.getNode(currentNodeId)) ||
    (nodeId
      ? [nodeId].filter((currentNodeId) => editor.getNode(currentNodeId))
      : null) ||
    editor.selectedNodeIds;
  const resolvedNodeIds = [
    ...new Set(
      editor.getEffectiveSelectionNodeIds(requestedNodeIds).flatMap((id) => {
        const node = editor.getNode(id);

        return isArtboardNode(node)
          ? [id, ...getDescendantLeafNodeIds(editor.nodes, id)]
          : [id];
      })
    ),
  ];

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
    previewNodeIds: [...requestedNodeIds],
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

  const previewNodeIds = session.previewNodeIds || session.nodeIds;

  measurePerf(PERF_SPANS.transformMovePreviewSet, () => {
    session.previewDelta = resolvedDelta;
    editor.setSelectionDragPreview({
      delta: resolvedDelta,
      effectiveNodeIdSet: new Set(session.nodeIds),
      nodeIdSet: new Set([...session.nodeIds, ...previewNodeIds]),
      nodeIds: previewNodeIds,
    });
  });

  return previewNodeIds;
};

const getAbsoluteMoveDelta = (session, { dragEvents = undefined, left = undefined, top = undefined } = {}) => {
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

const getNodeCenter = (editor, nodeId) => {
  const frame = editor.getNodeRenderFrame(nodeId);
  const bounds = frame?.bounds;

  return bounds
    ? {
        x: bounds.minX + bounds.width / 2,
        y: bounds.minY + bounds.height / 2,
      }
    : null;
};

const hasMovedArtboardAncestor = (editor, node, movedNodeIdSet) => {
  let currentParentId = node?.parentId || "root";

  while (currentParentId && currentParentId !== "root") {
    const parentNode = editor.getNode(currentParentId);

    if (isArtboardNode(parentNode) && movedNodeIdSet.has(parentNode.id)) {
      return true;
    }

    currentParentId = parentNode?.parentId || "root";
  }

  return false;
};

const getReparentableDraggedNodeIds = (editor, nodeIds) => {
  const movedNodeIdSet = new Set(nodeIds);

  return nodeIds.filter((nodeId) => {
    const node = editor.getNode(nodeId);
    const parentNode =
      node?.parentId && node.parentId !== "root"
        ? editor.getNode(node.parentId)
        : null;

    return Boolean(
      node &&
        !isArtboardNode(node) &&
        !hasMovedArtboardAncestor(editor, node, movedNodeIdSet) &&
        (node.parentId === "root" || isArtboardNode(parentNode))
    );
  });
};

const reparentDraggedNodesToArtboards = (editor, nodeIds) => {
  const reparentableNodeIds = getReparentableDraggedNodeIds(editor, nodeIds);
  const movedNodeIdSet = new Set(nodeIds);

  for (const nodeId of reparentableNodeIds) {
    const node = editor.getNode(nodeId);
    const center = getNodeCenter(editor, nodeId);

    if (!(node && center)) {
      continue;
    }

    const targetArtboard = getTopmostArtboardAtPoint(
      editor,
      center,
      movedNodeIdSet
    );
    const nextParentId = targetArtboard?.id || "root";

    if (node.parentId === nextParentId) {
      continue;
    }

    editor.moveNodeToParent(node.id, nextParentId, null);
  }
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

  reparentDraggedNodesToArtboards(editor, session.nodeIds);

  return session.nodeIds;
};

export const updateMoveSelection = (
  editor,
  session,
  { delta = undefined, dragEvents = undefined, left = undefined, top = undefined } = {}
) => {
  return measurePerf(PERF_SPANS.transformMoveAbsolute, () => {
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
  return measurePerf(PERF_SPANS.transformMoveBy, () => {
    const effectiveSelectedNodeIds = [
      ...new Set(
        editor.getEffectiveSelectionNodeIds().flatMap((id) => {
          const node = editor.getNode(id);

          return isArtboardNode(node)
            ? [id, ...getDescendantLeafNodeIds(editor.nodes, id)]
            : [id];
        })
      ),
    ];

    if (effectiveSelectedNodeIds.length === 0) {
      return [];
    }

    editor.updateNodes(effectiveSelectedNodeIds, (node) => ({
      transform: {
        x: round(getNodeX(node) + x, 2),
        y: round(getNodeY(node) + y, 2),
      },
    }));

    reparentDraggedNodesToArtboards(editor, effectiveSelectedNodeIds);

    return effectiveSelectedNodeIds;
  });
};

import {
  hasPointerMovedAtLeast,
  measurePerf,
  PERF_SPANS,
  recordPerfSpan,
  round,
} from "@punchpress/engine";
import { getCanvasDeepLeafNodeIdAtPoint } from "../canvas-overlay/vector-path/canvas-node-hit-target";

export const getCanvasPoint = (editor, clientX, clientY) => {
  const viewer = editor.viewerRef;
  const host = editor.hostRef;

  if (!(viewer && host)) {
    return { x: 0, y: 0 };
  }

  const rect = host.getBoundingClientRect();

  return {
    x: viewer.getScrollLeft() + (clientX - rect.left) / editor.zoom,
    y: viewer.getScrollTop() + (clientY - rect.top) / editor.zoom,
  };
};

export const recordPointerHandlerSpan = (label, startMs) => {
  const endMs = performance.now();

  recordPerfSpan({
    depth: 0,
    durationMs: Math.max(0, endMs - startMs),
    endMs,
    label,
    startMs,
  });
};

export const shouldStartNodeDrag = ({
  editor,
  event,
  isSelectionTargetSelected,
  node,
  nodeEditCapabilities,
}) => {
  const pathEditingNodeId = editor.pathEditingNodeId;
  const shouldDragSelectedPathNode = Boolean(
    isSelectionTargetSelected && nodeEditCapabilities?.hasExpandedHitBounds
  );
  const canDirectDragSelectedNode = Boolean(
    isSelectionTargetSelected &&
      (pathEditingNodeId !== node.id ||
        !nodeEditCapabilities?.hasExpandedHitBounds)
  );

  return Boolean(
    !event.shiftKey &&
      (!isSelectionTargetSelected ||
        canDirectDragSelectedNode ||
        shouldDragSelectedPathNode ||
        event.altKey)
  );
};

export const shouldDirectEnterPathEditing = ({ editor, event, nodeId }) => {
  if (
    event.shiftKey ||
    event.altKey ||
    editor.activeTool !== "pointer" ||
    !editor.pathEditingNodeId
  ) {
    return false;
  }

  if (editor.sharesPathEditingVisualOwner(nodeId)) {
    return false;
  }

  return editor.canStartPathEditing(nodeId);
};

export const getCanvasInteractionNodeId = (
  editor,
  activeTool,
  nodeId,
  event
) => {
  const node = editor.getNode(nodeId);

  if (
    !(
      activeTool === "node" ||
      editor.focusedGroupId ||
      editor.pathEditingNodeId
    )
  ) {
    if (node?.type === "group" || node?.type === "vector") {
      return getCanvasDeepLeafNodeIdAtPoint(
        editor,
        event.clientX,
        event.clientY
      );
    }

    return nodeId;
  }

  return (
    getCanvasDeepLeafNodeIdAtPoint(editor, event.clientX, event.clientY) ||
    nodeId
  );
};

export const getCanvasHoverNodeId = (editor, event, nodeId) => {
  const node = editor.getNode(nodeId);
  const deepNodeId = getCanvasDeepLeafNodeIdAtPoint(
    editor,
    event.clientX,
    event.clientY
  );

  if (!(editor.focusedGroupId || editor.pathEditingNodeId)) {
    if (node?.type === "group" || node?.type === "vector") {
      return deepNodeId
        ? editor.getSelectionTargetNodeId(deepNodeId) || deepNodeId
        : null;
    }

    return deepNodeId
      ? editor.getSelectionTargetNodeId(deepNodeId) || deepNodeId
      : null;
  }

  return deepNodeId
    ? editor.getSelectionTargetNodeId(deepNodeId) || deepNodeId
    : null;
};

export const clearSelectionFromUnpaintedNodeHit = ({
  activeTool,
  editor,
  event,
}) => {
  if (activeTool !== "pointer") {
    return false;
  }

  event.preventDefault();
  event.stopPropagation();
  editor.clearSelection();

  return true;
};

export const startCanvasNodeDragSession = ({
  editor,
  event,
  isSelectionTargetSelected,
  nodeId,
}) => {
  event.preventDefault();
  event.stopPropagation();
  const dragNodeId = editor.getSelectionTargetNodeId(nodeId) || nodeId;
  const dragNodeIds =
    isSelectionTargetSelected && editor.selectedNodeIds.length > 1
      ? [...editor.selectedNodeIds]
      : undefined;
  const startClientPoint = {
    x: event.clientX,
    y: event.clientY,
  };
  let previousCanvasPoint = getCanvasPoint(
    editor,
    event.clientX,
    event.clientY
  );
  let dragSession: ReturnType<typeof editor.beginSelectionDrag> = null;
  let didMove = false;
  const beginDragSession = () => {
    dragSession ??= editor.beginSelectionDrag({
      duplicate: event.altKey,
      nodeId: dragNodeId,
      nodeIds: dragNodeIds,
    });

    return dragSession;
  };
  const prewarmFrameId = isSelectionTargetSelected
    ? window.requestAnimationFrame(() => {
        if (!didMove) {
          const nextDragSession = beginDragSession();

          if (nextDragSession) {
            editor.updateSelectionDrag(nextDragSession, {
              delta: { x: 0, y: 0 },
            });
          }
        }
      })
    : 0;

  const handlePointerMove = (moveEvent) =>
    measurePerf(PERF_SPANS.pointerMoveHandle, () => {
      if (
        !(
          dragSession ||
          hasPointerMovedAtLeast(
            startClientPoint,
            { x: moveEvent.clientX, y: moveEvent.clientY },
            "pointerDrag"
          )
        )
      ) {
        return;
      }

      didMove = true;

      if (!beginDragSession()) {
        return;
      }

      const nextCanvasPoint = getCanvasPoint(
        editor,
        moveEvent.clientX,
        moveEvent.clientY
      );

      editor.updateSelectionDrag(dragSession, {
        delta: {
          x: round(nextCanvasPoint.x - previousCanvasPoint.x, 2),
          y: round(nextCanvasPoint.y - previousCanvasPoint.y, 2),
        },
        queueRefresh: true,
      });

      previousCanvasPoint = nextCanvasPoint;
    });

  const handlePointerEnd = () =>
    measurePerf(PERF_SPANS.pointerUpHandle, () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointercancel", handlePointerEnd);
      window.removeEventListener("pointerup", handlePointerEnd);
      window.cancelAnimationFrame(prewarmFrameId);

      if (dragSession) {
        editor.endSelectionDrag(dragSession, { cancel: !didMove });
      }
    });

  window.addEventListener("pointermove", handlePointerMove);
  window.addEventListener("pointercancel", handlePointerEnd);
  window.addEventListener("pointerup", handlePointerEnd);
};

export const shouldIgnoreCanvasNodePointerDown = ({
  activeTool,
  event,
  spacePressed,
}) => {
  return event.button !== 0 || spacePressed || activeTool === "hand";
};

export const shouldDeferNodeToolIdleSelection = (editor, activeTool) => {
  return activeTool === "node" && !editor.pathEditingNodeId;
};

export const handleNodeToolIdlePointerDown = ({
  activeTool,
  editor,
  event,
  nodeId,
  spacePressed,
}) => {
  if (
    event.detail >= 2 ||
    spacePressed ||
    activeTool !== "node" ||
    editor.pathEditingNodeId
  ) {
    return;
  }

  const startClientPoint = {
    x: event.clientX,
    y: event.clientY,
  };
  const interactionNodeId = getCanvasInteractionNodeId(
    editor,
    activeTool,
    nodeId,
    event
  );
  const node = editor.getNode(interactionNodeId);

  if (!node) {
    return;
  }

  let didMove = false;
  const handlePointerMove = (moveEvent) => {
    if (
      hasPointerMovedAtLeast(
        startClientPoint,
        { x: moveEvent.clientX, y: moveEvent.clientY },
        "selectionDrag"
      )
    ) {
      didMove = true;
    }
  };
  const handlePointerEnd = (upEvent) => {
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointercancel", handlePointerEnd);
    window.removeEventListener("pointerup", handlePointerEnd);

    if (didMove || editor.pathEditingNodeId) {
      return;
    }

    editor.dispatchNodePointerDown({
      event: upEvent,
      node,
      point: getCanvasPoint(editor, startClientPoint.x, startClientPoint.y),
    });
  };

  window.addEventListener("pointermove", handlePointerMove);
  window.addEventListener("pointercancel", handlePointerEnd);
  window.addEventListener("pointerup", handlePointerEnd);
};

import { round } from "@punchpress/engine";
import { memo } from "react";
import { cn } from "@/lib/utils";
import { useEditor } from "../../editor-react/use-editor";
import { useEditorValue } from "../../editor-react/use-editor-value";
import { usePerformanceRenderCounter } from "../../performance/use-performance-render-counter";
import { openCanvasNodeEditingMode } from "./canvas-node-editing";
import { startCanvasToolPlacementSession } from "./canvas-tool-placement-session";

const getCanvasPoint = (editor, clientX, clientY) => {
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

const selectNodeArtState = (editor, state, nodeId) => {
  const node = editor.getNode(nodeId);

  if (!node) {
    return null;
  }

  const geometry = editor.getNodeRenderGeometry(nodeId);
  const bbox = geometry?.bbox ||
    editor.getNodeRenderFrame(nodeId)?.bounds || {
      height: 0,
      maxX: 0,
      maxY: 0,
      minX: 0,
      minY: 0,
      width: 0,
    };

  return {
    bbox,
    fill: node.fill,
    fillRule: node.type === "vector" ? node.fillRule : undefined,
    isEditing: state.editingNodeId === nodeId,
    paths: geometry?.paths || [],
    ready: Boolean(geometry?.ready),
    stroke: node.stroke,
    strokeWidth: node.strokeWidth,
  };
};

const shouldStartNodeDrag = ({
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

const startCanvasNodeDragSession = ({
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

  const handlePointerMove = (moveEvent) => {
    const movedDistance = Math.hypot(
      moveEvent.clientX - startClientPoint.x,
      moveEvent.clientY - startClientPoint.y
    );

    if (!(dragSession || movedDistance >= 3)) {
      return;
    }

    if (!dragSession) {
      dragSession = editor.beginSelectionDrag({
        duplicate: event.altKey,
        nodeId: dragNodeId,
        nodeIds: dragNodeIds,
      });
    }

    if (!dragSession) {
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
  };

  const handlePointerEnd = () => {
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointercancel", handlePointerEnd);
    window.removeEventListener("pointerup", handlePointerEnd);

    if (dragSession) {
      editor.endSelectionDrag(dragSession);
    }
  };

  window.addEventListener("pointermove", handlePointerMove);
  window.addEventListener("pointercancel", handlePointerEnd);
  window.addEventListener("pointerup", handlePointerEnd);
};

const CanvasNodeComponent = ({ nodeId }) => {
  usePerformanceRenderCounter("render.canvas.node");
  const editor = useEditor();
  const activeTool = useEditorValue((_, state) => state.activeTool);
  const spacePressed = useEditorValue((_, state) => state.spacePressed);
  const isSelectionTargetSelected = useEditorValue((editor) => {
    const targetNodeId = editor.getSelectionTargetNodeId(nodeId) || nodeId;

    return editor.isSelected(targetNodeId);
  });
  const artState = useEditorValue((editor, state) =>
    selectNodeArtState(editor, state, nodeId)
  );

  if (!artState) {
    return null;
  }

  const isNodeDraggable =
    activeTool === "pointer" && !spacePressed && editor.editingNodeId === null;
  let cursorClassName = "canvas-cursor-default";

  return (
    <button
      className={cn(
        "canvas-node absolute block appearance-none border-0 bg-transparent p-0",
        cursorClassName,
        !artState.ready && "opacity-50"
      )}
      data-node-id={nodeId}
      data-selected={isSelectionTargetSelected ? "true" : "false"}
      onDoubleClick={() => {
        openCanvasNodeEditingMode(editor, nodeId);
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) {
          return;
        }

        if (spacePressed || activeTool === "hand") {
          return;
        }

        if (event.detail >= 2) {
          event.preventDefault();
          event.stopPropagation();
          openCanvasNodeEditingMode(editor, nodeId);
          return;
        }

        const node = editor.getNode(nodeId);

        if (!node) {
          return;
        }

        const nodeEditCapabilities = editor.getNodeEditCapabilities(nodeId);
        const shouldStartDragging = shouldStartNodeDrag({
          editor,
          event,
          isSelectionTargetSelected,
          node,
          nodeEditCapabilities,
        });

        const placementSession = editor.dispatchNodePointerDown({
          event,
          node,
          point: getCanvasPoint(editor, event.clientX, event.clientY),
        });

        if (
          startCanvasToolPlacementSession({
            editor,
            event,
            getCanvasPoint: (clientX, clientY) =>
              getCanvasPoint(editor, clientX, clientY),
            session: placementSession,
          })
        ) {
          return;
        }

        if (activeTool !== "pointer") {
          return;
        }

        if (shouldStartDragging) {
          startCanvasNodeDragSession({
            editor,
            event,
            isSelectionTargetSelected,
            nodeId,
          });
        }
      }}
      onPointerEnter={() => {
        if (spacePressed || activeTool !== "pointer") {
          return;
        }

        editor.setHoveredNode(
          editor.getSelectionTargetNodeId(nodeId) || nodeId
        );
      }}
      onPointerLeave={() => {
        const hoverTargetNodeId =
          editor.getSelectionTargetNodeId(nodeId) || nodeId;

        if (editor.hoveredNodeId !== hoverTargetNodeId) {
          return;
        }

        editor.setHoveredNode(null);
      }}
      ref={(element) => {
        editor.registerNodeElement(nodeId, element);
      }}
      style={{ left: 0, top: 0, transformOrigin: "center center" }}
      type="button"
    >
      <CanvasNodeArt
        bbox={artState.bbox}
        fill={artState.fill}
        fillRule={artState.fillRule}
        height={Math.max(1, artState.bbox.height)}
        isEditing={artState.isEditing}
        paths={artState.paths}
        stroke={artState.stroke}
        strokeWidth={artState.strokeWidth}
        width={Math.max(1, artState.bbox.width)}
      />
    </button>
  );
};

export const CanvasNode = memo(CanvasNodeComponent);

const CanvasNodeArt = memo(
  ({
    bbox,
    fill,
    fillRule,
    height,
    isEditing,
    paths,
    stroke,
    strokeWidth,
    width,
  }) => {
    return (
      <svg
        aria-label="Canvas node"
        className="block overflow-visible"
        height={height}
        role="img"
        viewBox={`0 0 ${width} ${height}`}
        width={width}
      >
        <g transform={`translate(${-bbox.minX} ${-bbox.minY})`}>
          {paths.map((path) => {
            return (
              <path
                d={path.d}
                fill={fill || "none"}
                fillRule={fillRule}
                key={path.key || `${path.transform || "shape"}-${path.d}`}
                opacity={isEditing ? 0 : 1}
                paintOrder="stroke fill"
                pointerEvents="none"
                stroke={stroke}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={strokeWidth}
                transform={path.transform || undefined}
              />
            );
          })}
        </g>
      </svg>
    );
  }
);

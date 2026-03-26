import { estimateBounds, round } from "@punchpress/engine";
import { memo } from "react";
import { cn } from "@/lib/utils";
import { useEditor } from "../../editor-react/use-editor";
import { useEditorValue } from "../../editor-react/use-editor-value";
import { usePerformanceRenderCounter } from "../../performance/use-performance-render-counter";
import { drillIntoGroupSelection } from "./canvas-group-drill-in";

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
  const bbox = geometry?.bbox || estimateBounds(node);

  return {
    bbox,
    fill: node.fill,
    isEditing: state.editingNodeId === nodeId,
    paths: geometry?.paths || [],
    ready: Boolean(geometry?.ready),
    stroke: node.stroke,
    strokeWidth: node.strokeWidth,
  };
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
  let cursorClassName = "cursor-default";

  if (isNodeDraggable) {
    if (isSelectionTargetSelected) {
      cursorClassName = "cursor-grab";
    } else {
      cursorClassName = "cursor-pointer";
    }
  }

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
        if (drillIntoGroupSelection(editor, nodeId)) {
          return;
        }

        const node = editor.getNode(nodeId);
        const nodeEditCapabilities = editor.getNodeEditCapabilities(nodeId);

        if (!(node && nodeEditCapabilities?.canEditText)) {
          return;
        }

        editor.startEditing(node);
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) {
          return;
        }

        if (spacePressed || activeTool === "hand") {
          return;
        }

        const node = editor.getNode(nodeId);

        if (!node) {
          return;
        }

        const nodeEditCapabilities = editor.getNodeEditCapabilities(nodeId);
        const pathEditingNodeId = editor.pathEditingNodeId;
        const shouldDragSelectedPathNode = Boolean(
          isSelectionTargetSelected &&
            nodeEditCapabilities?.hasExpandedHitBounds
        );
        const canDirectDragSelectedNode = Boolean(
          isSelectionTargetSelected &&
            (pathEditingNodeId !== node.id ||
              !nodeEditCapabilities?.hasExpandedHitBounds)
        );
        const shouldStartDragging = Boolean(
          !event.shiftKey &&
            (!isSelectionTargetSelected ||
              canDirectDragSelectedNode ||
              shouldDragSelectedPathNode ||
              event.altKey)
        );

        editor.dispatchNodePointerDown({ event, node });

        if (shouldStartDragging) {
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
  ({ bbox, fill, height, isEditing, paths, stroke, strokeWidth, width }) => {
    return (
      <svg
        aria-label="Warped text node"
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
                fill={fill}
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

import { estimateBounds, getNodeCssTransform, round } from "@punchpress/engine";
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

const getNodePreviewTransform = (isSelectionTargetSelected) => {
  return isSelectionTargetSelected
    ? "translate3d(var(--canvas-selection-preview-x, 0px), var(--canvas-selection-preview-y, 0px), 0)"
    : "";
};

const selectNodeRenderFrame = (editor, nodeId) => {
  const frame = editor.getNodeRenderFrame(nodeId);

  return frame
    ? [
        frame.bounds.height,
        frame.bounds.minX,
        frame.bounds.minY,
        frame.bounds.width,
        frame.transform || "",
      ]
    : null;
};

const CanvasNodeComponent = ({ nodeId }) => {
  usePerformanceRenderCounter("render.canvas.node");
  const editor = useEditor();
  const activeTool = useEditorValue((_, state) => state.activeTool);
  const editingNodeId = useEditorValue((_, state) => state.editingNodeId);
  const pathEditingNodeId = useEditorValue(
    (_, state) => state.pathEditingNodeId
  );
  const isSelectionDragging = useEditorValue(
    (_, state) => state.isSelectionDragging
  );
  const selectedNodeIds = useEditorValue((_, state) => state.selectedNodeIds);
  const spacePressed = useEditorValue((_, state) => state.spacePressed);
  const isSelectionTargetSelected = useEditorValue((editor) => {
    const targetNodeId = editor.getSelectionTargetNodeId(nodeId) || nodeId;

    return editor.isSelected(targetNodeId);
  });
  const frame = useEditorValue((editor) =>
    selectNodeRenderFrame(editor, nodeId)
  );
  const node = useEditorValue((editor) => editor.getNode(nodeId));
  const nodeEditCapabilities = useEditorValue((editor) =>
    editor.getNodeEditCapabilities(nodeId)
  );
  const geometry = useEditorValue((editor) =>
    editor.getNodeRenderGeometry(nodeId)
  );

  if (!node) {
    return null;
  }

  const bbox = geometry?.bbox || estimateBounds(node);
  const [frameHeight, frameMinX, frameMinY, frameWidth, frameTransform] =
    frame || [];
  const width = Math.max(1, frameWidth || bbox.width);
  const height = Math.max(1, frameHeight || bbox.height);
  const isEditing = editingNodeId === nodeId;
  const isNodeDraggable =
    activeTool === "pointer" && !spacePressed && editingNodeId === null;
  const nodeTransform = frameTransform || getNodeCssTransform(node);
  const previewTransform = getNodePreviewTransform(isSelectionTargetSelected);
  const translateX = frameMinX ?? bbox.minX;
  const translateY = frameMinY ?? bbox.minY;
  let cursorClassName = "cursor-default";

  if (isNodeDraggable) {
    if (isSelectionTargetSelected && isSelectionDragging) {
      cursorClassName = "cursor-grabbing";
    } else if (isSelectionTargetSelected) {
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
        !geometry?.ready && "opacity-50"
      )}
      data-node-id={node.id}
      onDoubleClick={() => {
        if (drillIntoGroupSelection(editor, node.id)) {
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

        const shouldDragSelectedPathNode = Boolean(
          isSelectionTargetSelected &&
            nodeEditCapabilities?.hasExpandedHitBounds
        );
        const canDirectDragSelectedNode = Boolean(
          isSelectionTargetSelected && pathEditingNodeId !== node.id
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
          const dragNodeId =
            editor.getSelectionTargetNodeId(node.id) || node.id;
          const dragNodeIds =
            isSelectionTargetSelected && selectedNodeIds.length > 1
              ? [...selectedNodeIds]
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
          editor.getSelectionTargetNodeId(node.id) || node.id
        );
      }}
      onPointerLeave={() => {
        const hoverTargetNodeId =
          editor.getSelectionTargetNodeId(node.id) || node.id;

        if (editor.hoveredNodeId !== hoverTargetNodeId) {
          return;
        }

        editor.setHoveredNode(null);
      }}
      ref={(element) => editor.registerNodeElement(node.id, element)}
      style={{
        height: `${height}px`,
        left: 0,
        top: 0,
        transform: nodeTransform
          ? `translate3d(${translateX}px, ${translateY}px, 0) ${previewTransform} ${nodeTransform}`
          : `translate3d(${translateX}px, ${translateY}px, 0) ${previewTransform}`,
        transformOrigin: "center center",
        width: `${width}px`,
      }}
      type="button"
    >
      <CanvasNodeArt
        bbox={bbox}
        fill={node.fill}
        height={height}
        isEditing={isEditing}
        paths={geometry?.paths || []}
        stroke={node.stroke}
        strokeWidth={node.strokeWidth}
        width={width}
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

import {
  estimateBounds,
  getNodeCssTransform,
  getNodeX,
  getNodeY,
  round,
} from "@punchpress/engine";
import { cn } from "@/lib/utils";
import { useEditor } from "../../editor-react/use-editor";
import { useEditorValue } from "../../editor-react/use-editor-value";
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

export const CanvasNode = ({ nodeId }) => {
  const editor = useEditor();
  const activeTool = useEditorValue((_, state) => state.activeTool);
  const editingNodeId = useEditorValue((_, state) => state.editingNodeId);
  const isSelectionDragging = useEditorValue(
    (_, state) => state.isSelectionDragging
  );
  const spacePressed = useEditorValue((_, state) => state.spacePressed);
  const isSelectionTargetSelected = useEditorValue((editor) => {
    const targetNodeId = editor.getSelectionTargetNodeId(nodeId) || nodeId;

    return editor.isSelected(targetNodeId);
  });
  const node = useEditorValue((editor) => editor.getNode(nodeId));
  const geometry = useEditorValue((editor) => editor.getNodeGeometry(nodeId));

  if (!node) {
    return null;
  }

  const bbox = geometry?.bbox || estimateBounds(node);
  const width = Math.max(1, bbox.width);
  const height = Math.max(1, bbox.height);
  const isEditing = editingNodeId === nodeId;
  const isNodeDraggable =
    activeTool === "pointer" && !spacePressed && editingNodeId === null;
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
          isSelectionTargetSelected && geometry?.selectionBounds
        );
        const shouldStartDragging = Boolean(
          !event.shiftKey &&
            (!isSelectionTargetSelected ||
              shouldDragSelectedPathNode ||
              event.altKey)
        );

        editor.dispatchNodePointerDown({ event, node });

        if (shouldStartDragging) {
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
                nodeId: node.id,
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
        left: `${getNodeX(node) + bbox.minX}px`,
        top: `${getNodeY(node) + bbox.minY}px`,
        transform: getNodeCssTransform(node),
        transformOrigin: "center center",
        width: `${width}px`,
      }}
      type="button"
    >
      <svg
        aria-label="Warped text node"
        className="block overflow-visible"
        height={height}
        role="img"
        viewBox={`0 0 ${width} ${height}`}
        width={width}
      >
        <g transform={`translate(${-bbox.minX} ${-bbox.minY})`}>
          {(geometry?.paths || []).map((path) => {
            return (
              <path
                d={path.d}
                fill={node.fill}
                key={path.key || `${path.transform || "shape"}-${path.d}`}
                opacity={isEditing ? 0 : 1}
                paintOrder="stroke fill"
                pointerEvents="none"
                stroke={node.stroke}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={node.strokeWidth}
                transform={path.transform || undefined}
              />
            );
          })}
        </g>
      </svg>
    </button>
  );
};

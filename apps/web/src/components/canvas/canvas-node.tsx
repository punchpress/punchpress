import {
  DEFAULT_VECTOR_STROKE_LINE_CAP,
  DEFAULT_VECTOR_STROKE_LINE_JOIN,
  DEFAULT_VECTOR_STROKE_MITER_LIMIT,
  round,
} from "@punchpress/engine";
import { memo } from "react";
import { NodeContextMenuItems } from "@/components/context-menus/node-context-menu-items";
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import { useEditor } from "../../editor-react/use-editor";
import { useEditorSurfaceValue } from "../../editor-react/use-editor-surface-value";
import { useEditorValue } from "../../editor-react/use-editor-value";
import { usePerformanceRenderCounter } from "../../performance/use-performance-render-counter";
import { openCanvasNodeEditingMode } from "./canvas-node-editing";
import { startCanvasToolPlacementSession } from "./canvas-tool-placement-session";
import { getVectorPathPaintOrder } from "./vector-paint-order";

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
    fillRule: node.type === "path" ? node.fillRule : undefined,
    isEditing: state.editingNodeId === nodeId,
    paths: geometry?.paths || [],
    ready: Boolean(geometry?.ready),
    stroke: node.stroke,
    strokeLineCap:
      node.type === "path"
        ? (node.strokeLineCap ?? DEFAULT_VECTOR_STROKE_LINE_CAP)
        : DEFAULT_VECTOR_STROKE_LINE_CAP,
    strokeLineJoin:
      node.type === "path"
        ? (node.strokeLineJoin ?? DEFAULT_VECTOR_STROKE_LINE_JOIN)
        : DEFAULT_VECTOR_STROKE_LINE_JOIN,
    strokeMiterLimit:
      node.type === "path"
        ? (node.strokeMiterLimit ?? DEFAULT_VECTOR_STROKE_MITER_LIMIT)
        : DEFAULT_VECTOR_STROKE_MITER_LIMIT,
    strokeWidth: node.strokeWidth,
  };
};

const getCanvasNodePathFill = (path, fill) => {
  return path.closed === false ? "none" : path.fill || fill || "none";
};

const selectNodeReadyState = (editor, state, nodeId) => {
  return Boolean(selectNodeArtState(editor, state, nodeId)?.ready);
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

const shouldDirectEnterPathEditing = ({ editor, event, nodeId }) => {
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

const CanvasNodeShell = ({ children, isReady, nodeId }) => {
  usePerformanceRenderCounter("render.canvas.node");
  const editor = useEditor();
  const activeTool = useEditorValue((_, state) => state.activeTool);
  const contextMenuNodeId = useEditorValue((editor) => {
    return editor.getSelectionTargetNodeId(nodeId) || nodeId;
  });
  const spacePressed = useEditorValue((_, state) => state.spacePressed);
  const isSelectionTargetSelected = useEditorValue((editor) => {
    const targetNodeId = editor.getSelectionTargetNodeId(nodeId) || nodeId;

    return editor.isSelected(targetNodeId);
  });
  const cursorClassName = "canvas-cursor-default";

  return (
    <ContextMenu>
      <ContextMenuTrigger
        data-node-id={nodeId}
        data-selected={isSelectionTargetSelected ? "true" : "false"}
        onContextMenuCapture={() => {
          if (!editor.isSelected(contextMenuNodeId)) {
            editor.select(contextMenuNodeId);
          }
        }}
        ref={(element) => {
          editor.registerNodeElement(nodeId, element);
        }}
        render={
          <button
            className={cn(
              "canvas-node absolute block h-full w-full appearance-none border-0 bg-transparent p-0",
              cursorClassName,
              !isReady && "opacity-50"
            )}
            onDoubleClick={(event) => {
              openCanvasNodeEditingMode(editor, nodeId, {
                clientPoint: {
                  x: event.clientX,
                  y: event.clientY,
                },
              });
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
                openCanvasNodeEditingMode(editor, nodeId, {
                  clientPoint: {
                    x: event.clientX,
                    y: event.clientY,
                  },
                });
                return;
              }

              const node = editor.getNode(nodeId);

              if (!node) {
                return;
              }

              if (
                shouldDirectEnterPathEditing({
                  editor,
                  event,
                  nodeId,
                })
              ) {
                event.preventDefault();
                event.stopPropagation();
                editor.startPathEditing(nodeId);
                return;
              }

              const nodeEditCapabilities =
                editor.getNodeEditCapabilities(nodeId);
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
            type="button"
          />
        }
        style={{ left: 0, top: 0, transformOrigin: "center center" }}
      >
        {children}
      </ContextMenuTrigger>
      <NodeContextMenuItems nodeId={contextMenuNodeId} />
    </ContextMenu>
  );
};

const CanvasStandardNodeArt = ({ nodeId }) => {
  const artState = useEditorValue((editor, state) =>
    selectNodeArtState(editor, state, nodeId)
  );

  return artState ? (
    <CanvasNodeArt
      bbox={artState.bbox}
      fill={artState.fill}
      fillRule={artState.fillRule}
      height={Math.max(1, artState.bbox.height)}
      isEditing={artState.isEditing}
      paths={artState.paths}
      stroke={artState.stroke}
      strokeLineCap={artState.strokeLineCap}
      strokeLineJoin={artState.strokeLineJoin}
      strokeMiterLimit={artState.strokeMiterLimit}
      strokeWidth={artState.strokeWidth}
      width={Math.max(1, artState.bbox.width)}
    />
  ) : null;
};

const CanvasVectorNodeArt = ({ nodeId }) => {
  const artState = useEditorSurfaceValue((editor, state) => {
    return selectNodeArtState(editor, state, nodeId);
  });

  return artState ? (
    <CanvasNodeArt
      bbox={artState.bbox}
      fill={artState.fill}
      fillRule={artState.fillRule}
      height={Math.max(1, artState.bbox.height)}
      isEditing={artState.isEditing}
      paths={artState.paths}
      stroke={artState.stroke}
      strokeLineCap={artState.strokeLineCap}
      strokeLineJoin={artState.strokeLineJoin}
      strokeMiterLimit={artState.strokeMiterLimit}
      strokeWidth={artState.strokeWidth}
      width={Math.max(1, artState.bbox.width)}
    />
  ) : null;
};

const CanvasNodeArtContent = ({ nodeId }) => {
  const isVectorNode = useEditorValue((editor) => {
    return editor.getNode(nodeId)?.type === "vector";
  });

  return isVectorNode ? (
    <CanvasVectorNodeArt nodeId={nodeId} />
  ) : (
    <CanvasStandardNodeArt nodeId={nodeId} />
  );
};

const CanvasNodeComponent = ({ nodeId }) => {
  const isReady = useEditorValue((editor, state) => {
    return selectNodeReadyState(editor, state, nodeId);
  });
  const nodeExists = useEditorValue((editor) => {
    return Boolean(editor.getNode(nodeId));
  });

  if (!nodeExists) {
    return null;
  }

  return (
    <CanvasNodeShell isReady={isReady} nodeId={nodeId}>
      <CanvasNodeArtContent nodeId={nodeId} />
    </CanvasNodeShell>
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
    strokeLineCap,
    strokeLineJoin,
    strokeMiterLimit,
    strokeWidth,
    width,
  }) => {
    return (
      <svg
        aria-label="Canvas node"
        className="pointer-events-none block overflow-visible"
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
                fill={getCanvasNodePathFill(path, fill)}
                fillRule={path.fillRule || fillRule}
                key={path.key || `${path.transform || "shape"}-${path.d}`}
                opacity={isEditing ? 0 : 1}
                paintOrder={getVectorPathPaintOrder()}
                pointerEvents="none"
                stroke={path.stroke || stroke}
                strokeLinecap={path.strokeLineCap || strokeLineCap}
                strokeLinejoin={path.strokeLineJoin || strokeLineJoin}
                strokeMiterlimit={path.strokeMiterLimit ?? strokeMiterLimit}
                strokeWidth={path.strokeWidth ?? strokeWidth}
                transform={path.transform || undefined}
              />
            );
          })}
        </g>
      </svg>
    );
  }
);

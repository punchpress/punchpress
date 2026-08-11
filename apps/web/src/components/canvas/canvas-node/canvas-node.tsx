import { PERF_COUNTERS, PERF_SPANS } from "@punchpress/engine";
import { memo, type ReactNode, useMemo } from "react";
import { NodeContextMenuItems } from "@/components/context-menus/node-context-menu-items";
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import { useEditor } from "../../../editor-react/use-editor";
import { useEditorSurfaceValue } from "../../../editor-react/use-editor-surface-value";
import { useEditorValue } from "../../../editor-react/use-editor-value";
import {
  getInteractionTimingStart,
  logInteractionCheckpoint,
  logInteractionNextPaint,
} from "../../../performance/interaction-timing-log";
import { usePerformanceRenderCounter } from "../../../performance/use-performance-render-counter";
import { openCanvasNodeEditingMode } from "../canvas-node-editing";
import { startCanvasToolPlacementSession } from "../canvas-tool-placement-session";
import { CanvasRasterImage } from "../raster/canvas-raster-image";
import {
  getMemoizedNodeArtState,
  getResizePreviewNode,
  selectNodeArtInputs,
  selectNodeReadyState,
} from "./node-art-state";
import {
  clearSelectionFromUnpaintedNodeHit,
  getCanvasHoverNodeId,
  getCanvasInteractionNodeId,
  getCanvasPoint,
  handleNodeToolIdlePointerDown,
  recordPointerHandlerSpan,
  shouldDeferNodeToolIdleSelection,
  shouldDirectEnterPathEditing,
  shouldIgnoreCanvasNodePointerDown,
  shouldStartNodeDrag,
  startCanvasNodeDragSession,
} from "./node-interactions";
import {
  CanvasNodePath,
  CanvasNodeRenderTree,
  getPaintPreviewStyle,
} from "./node-render-tree";

const CanvasNodeShell = ({ children, isReady, nodeId }) => {
  usePerformanceRenderCounter(PERF_COUNTERS.renderCanvasNode);
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
  const rasterHitArea = useEditorValue((editor) => {
    const node = editor.getNode(nodeId);
    const writableBounds = editor.getRasterWritableBounds(nodeId);

    if (!(node?.type === "image" && writableBounds)) {
      return null;
    }

    return {
      height: node.height,
      left: -writableBounds.x,
      top: -writableBounds.y,
      width: node.width,
    };
  });
  const cursorClassName = "canvas-cursor-default";

  return (
    <ContextMenu>
      <div
        className="pointer-events-none absolute"
        data-node-shell="true"
        style={{
          contain: "layout style",
        }}
      >
        <div
          className={cn(
            "canvas-node pointer-events-none absolute h-full w-full",
            !isReady && "opacity-50"
          )}
          data-node-id={nodeId}
          data-selected={isSelectionTargetSelected ? "true" : "false"}
          ref={(element) => {
            editor.registerNodeElement(nodeId, element);
          }}
          style={{
            transformOrigin: "center center",
          }}
        >
          {children}
          <ContextMenuTrigger
            onContextMenuCapture={() => {
              if (!editor.isSelected(contextMenuNodeId)) {
                editor.select(contextMenuNodeId);
              }
            }}
            render={
              <button
                className={cn(
                  "pointer-events-auto absolute block h-full w-full appearance-none border-0 bg-transparent p-0",
                  cursorClassName
                )}
                onDoubleClick={(event) => {
                  const interactionNodeId = getCanvasInteractionNodeId(
                    editor,
                    activeTool,
                    nodeId,
                    event
                  );

                  openCanvasNodeEditingMode(editor, interactionNodeId, {
                    clientPoint: {
                      x: event.clientX,
                      y: event.clientY,
                    },
                  });
                }}
                onPointerDown={(event) => {
                  const pointerHandleStartedAt = performance.now();

                  try {
                    const timingStartedAt = getInteractionTimingStart();

                    if (
                      shouldIgnoreCanvasNodePointerDown({
                        activeTool,
                        event,
                        spacePressed,
                      })
                    ) {
                      return;
                    }

                    if (event.detail >= 2) {
                      event.preventDefault();
                      event.stopPropagation();
                      const interactionNodeId = getCanvasInteractionNodeId(
                        editor,
                        activeTool,
                        nodeId,
                        event
                      );

                      openCanvasNodeEditingMode(editor, interactionNodeId, {
                        clientPoint: {
                          x: event.clientX,
                          y: event.clientY,
                        },
                      });
                      return;
                    }

                    if (shouldDeferNodeToolIdleSelection(editor, activeTool)) {
                      handleNodeToolIdlePointerDown({
                        activeTool,
                        editor,
                        event,
                        nodeId,
                        spacePressed,
                      });
                      return;
                    }

                    const interactionNodeId = getCanvasInteractionNodeId(
                      editor,
                      activeTool,
                      nodeId,
                      event
                    );
                    const node = editor.getNode(interactionNodeId);

                    if (!node) {
                      clearSelectionFromUnpaintedNodeHit({
                        activeTool,
                        editor,
                        event,
                      });
                      logInteractionCheckpoint(
                        "canvas.nodePointerDown.unpaintedClear",
                        timingStartedAt,
                        {
                          nodeId,
                          selectedNodeCount: editor.selectedNodeIds.length,
                        }
                      );
                      logInteractionNextPaint(
                        "canvas.nodePointerDown.unpaintedClear",
                        timingStartedAt,
                        () => ({
                          selectedNodeCount: editor.selectedNodeIds.length,
                        })
                      );
                      return;
                    }

                    if (
                      shouldDirectEnterPathEditing({
                        editor,
                        event,
                        nodeId: interactionNodeId,
                      })
                    ) {
                      event.preventDefault();
                      event.stopPropagation();
                      editor.startPathEditing(interactionNodeId);
                      return;
                    }

                    const nodeEditCapabilities =
                      editor.getNodeEditCapabilities(interactionNodeId);
                    const canDragWithActiveTool =
                      activeTool === "pointer" ||
                      Boolean(
                        activeTool === "node" &&
                          editor.isPathEditing(interactionNodeId) &&
                          nodeEditCapabilities?.pathEditingOverlayMode ===
                            "keep-transform"
                      );
                    const interactionSelectionTargetNodeId =
                      editor.getSelectionTargetNodeId(interactionNodeId) ||
                      interactionNodeId;
                    const isInteractionSelectionTargetSelected =
                      editor.isSelected(interactionSelectionTargetNodeId);
                    const shouldStartDragging = shouldStartNodeDrag({
                      editor,
                      event,
                      isSelectionTargetSelected:
                        isInteractionSelectionTargetSelected,
                      node,
                      nodeEditCapabilities,
                    });

                    const placementSession = editor.dispatchNodePointerDown({
                      event,
                      node,
                      point: getCanvasPoint(
                        editor,
                        event.clientX,
                        event.clientY
                      ),
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

                    if (!canDragWithActiveTool) {
                      return;
                    }

                    if (shouldStartDragging) {
                      startCanvasNodeDragSession({
                        editor,
                        event,
                        isSelectionTargetSelected:
                          isInteractionSelectionTargetSelected,
                        nodeId: interactionNodeId,
                      });
                    }
                  } finally {
                    recordPointerHandlerSpan(
                      PERF_SPANS.pointerDownHandle,
                      pointerHandleStartedAt
                    );
                  }
                }}
                onPointerEnter={(event) => {
                  if (spacePressed || activeTool !== "pointer") {
                    return;
                  }

                  editor.setHoveredNode(
                    getCanvasHoverNodeId(editor, event, nodeId)
                  );
                }}
                onPointerLeave={() => {
                  if (!editor.hoveredNodeId) {
                    return;
                  }

                  const hoverTargetNodeId =
                    editor.getSelectionTargetNodeId(nodeId) || nodeId;

                  if (editor.hoveredNodeId !== hoverTargetNodeId) {
                    return;
                  }

                  editor.setHoveredNode(null);
                }}
                onPointerMove={(event) => {
                  if (
                    spacePressed ||
                    activeTool !== "pointer" ||
                    event.buttons !== 0
                  ) {
                    return;
                  }

                  const hoverTargetNodeId = getCanvasHoverNodeId(
                    editor,
                    event,
                    nodeId
                  );

                  if (editor.hoveredNodeId === hoverTargetNodeId) {
                    return;
                  }

                  editor.setHoveredNode(hoverTargetNodeId);
                }}
                style={rasterHitArea || { left: 0, top: 0 }}
                type="button"
              />
            }
          />
        </div>
      </div>
      <NodeContextMenuItems nodeId={contextMenuNodeId} />
    </ContextMenu>
  );
};

const CanvasStandardNodeArt = ({ nodeId }) => {
  const artInputs = useEditorValue((editor, state) =>
    selectNodeArtInputs(editor, state, nodeId)
  );
  const resizePreviewNode = useEditorSurfaceValue((editor) =>
    getResizePreviewNode(editor, nodeId)
  );
  const paintPreview = useEditorSurfaceValue((editor) =>
    editor.getSelectionColorPreviewForNode(nodeId)
  );
  const editor = useEditor();
  const artState = useMemo(
    () =>
      getMemoizedNodeArtState(editor, nodeId, artInputs, 0, resizePreviewNode),
    [artInputs, editor, nodeId, resizePreviewNode]
  );

  if (!artState) {
    return null;
  }

  const writableBounds = editor.getRasterWritableBounds(nodeId);
  const durablePresentationBounds = writableBounds
    ? {
        height: writableBounds.height,
        maxX: writableBounds.x + writableBounds.width,
        maxY: writableBounds.y + writableBounds.height,
        minX: writableBounds.x,
        minY: writableBounds.y,
        width: writableBounds.width,
      }
    : null;
  const presentationBounds = resizePreviewNode
    ? artState.bbox
    : durablePresentationBounds || artState.bbox;
  const node = editor.getNode(nodeId);
  const parentNode = node?.parentId ? editor.getNode(node.parentId) : null;

  return (
    <CanvasNodeArt
      allowImageOverflow={Boolean(
        artState.image && parentNode?.type === "artboard"
      )}
      bbox={presentationBounds}
      fill={artState.fill}
      fillRule={artState.fillRule}
      height={Math.max(1, presentationBounds.height)}
      image={artState.image}
      isEditing={artState.isEditing}
      isInteractionProxy={artState.isInteractionProxy}
      opacity={artState.opacity}
      paintPreview={paintPreview}
      paths={artState.paths}
      renderMode={artState.renderMode}
      renderRootNodeId={nodeId}
      renderTree={artState.renderTree}
      stroke={artState.stroke}
      strokeLineCap={artState.strokeLineCap}
      strokeLineJoin={artState.strokeLineJoin}
      strokeMiterLimit={artState.strokeMiterLimit}
      strokeWidth={artState.strokeWidth}
      width={Math.max(1, presentationBounds.width)}
    />
  );
};

const CanvasVectorNodeArt = ({ nodeId }) => {
  const artInputs = useEditorValue((editor, state) =>
    selectNodeArtInputs(editor, state, nodeId)
  );
  const previewRevision = useEditorSurfaceValue((editor) => {
    return editor.getInteractionPreviewRevision();
  });
  const paintPreview = useEditorSurfaceValue((editor) =>
    editor.getSelectionColorPreviewForNode(nodeId)
  );
  const editor = useEditor();
  const artState = useMemo(
    () => getMemoizedNodeArtState(editor, nodeId, artInputs, previewRevision),
    [artInputs, editor, nodeId, previewRevision]
  );

  return artState ? (
    <CanvasNodeArt
      bbox={artState.bbox}
      fill={artState.fill}
      fillRule={artState.fillRule}
      height={Math.max(1, artState.bbox.height)}
      image={artState.image}
      isEditing={artState.isEditing}
      isInteractionProxy={artState.isInteractionProxy}
      opacity={artState.opacity}
      paintPreview={paintPreview}
      paths={artState.paths}
      renderMode={artState.renderMode}
      renderRootNodeId={nodeId}
      renderTree={artState.renderTree}
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
    allowImageOverflow,
    bbox,
    fill,
    fillRule,
    height,
    isEditing,
    isInteractionProxy,
    image,
    opacity,
    paintPreview,
    paths,
    renderRootNodeId,
    renderMode,
    renderTree,
    stroke,
    strokeLineCap,
    strokeLineJoin,
    strokeMiterLimit,
    strokeWidth,
    width,
  }) => {
    let renderedContent: ReactNode = null;

    if (!(isInteractionProxy || renderMode === "image")) {
      if (image) {
        renderedContent = (
          <CanvasRasterImage
            baseHeight={image.baseHeight}
            baseWidth={image.baseWidth}
            baseX={image.baseX}
            baseY={image.baseY}
            height={image.height}
            nodeId={image.id}
            renderRootNodeId={renderRootNodeId}
            src={image.src}
            width={image.width}
          />
        );
      } else if (renderTree) {
        renderedContent = (
          <CanvasNodeRenderTree
            fill={fill}
            fillRule={fillRule}
            isEditing={isEditing}
            items={renderTree}
            renderRootNodeId={renderRootNodeId}
            stroke={stroke}
            strokeLineCap={strokeLineCap}
            strokeLineJoin={strokeLineJoin}
            strokeMiterLimit={strokeMiterLimit}
            strokeWidth={strokeWidth}
          />
        );
      } else {
        renderedContent = paths.map((path) => {
          return (
            <CanvasNodePath
              fill={fill}
              fillRule={fillRule}
              isEditing={isEditing}
              key={path.key || `${path.transform || "shape"}-${path.d}`}
              path={path}
              stroke={stroke}
              strokeLineCap={strokeLineCap}
              strokeLineJoin={strokeLineJoin}
              strokeMiterLimit={strokeMiterLimit}
              strokeWidth={strokeWidth}
            />
          );
        });
      }
    }

    return (
      <svg
        aria-label="Canvas node"
        className={cn(
          "pointer-events-none block h-full w-full",
          image && !allowImageOverflow ? "overflow-hidden" : "overflow-visible"
        )}
        height={height}
        role="img"
        style={getPaintPreviewStyle(paintPreview)}
        viewBox={`0 0 ${width} ${height}`}
        width={width}
      >
        <g
          opacity={opacity ?? 1}
          transform={`translate(${-bbox.minX} ${-bbox.minY})`}
        >
          {isInteractionProxy ? (
            <rect
              fill="rgba(0, 0, 0, 0.08)"
              height={bbox.height}
              stroke="rgba(0, 0, 0, 0.28)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
              width={bbox.width}
              x={bbox.minX}
              y={bbox.minY}
            />
          ) : null}
          {renderedContent}
        </g>
      </svg>
    );
  }
);

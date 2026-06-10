import {
  DEFAULT_VECTOR_STROKE_LINE_CAP,
  DEFAULT_VECTOR_STROKE_LINE_JOIN,
  DEFAULT_VECTOR_STROKE_MITER_LIMIT,
  format,
  getNodeLocalMatrix,
  getNodeLocalTransformBounds,
  getNodeRotation,
  getNodeScaleX,
  getNodeScaleY,
  getNodeX,
  getNodeY,
  hasPointerMovedAtLeast,
  measurePerf,
  PERF_COUNTERS,
  PERF_SPANS,
  recordPerfSpan,
  round,
} from "@punchpress/engine";
import { memo, type ReactNode, useMemo } from "react";
import { NodeContextMenuItems } from "@/components/context-menus/node-context-menu-items";
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import { useEditor } from "../../editor-react/use-editor";
import { useEditorSurfaceValue } from "../../editor-react/use-editor-surface-value";
import { useEditorValue } from "../../editor-react/use-editor-value";
import {
  getInteractionTimingStart,
  logInteractionCheckpoint,
  logInteractionNextPaint,
} from "../../performance/interaction-timing-log";
import { usePerformanceRenderCounter } from "../../performance/use-performance-render-counter";
import { openCanvasNodeEditingMode } from "./canvas-node-editing";
import { getCanvasDeepLeafNodeIdAtPoint } from "./canvas-overlay/vector-path/canvas-node-hit-target";
import { startCanvasToolPlacementSession } from "./canvas-tool-placement-session";
import { CanvasRasterImage } from "./raster/canvas-raster-image";
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

const recordPointerHandlerSpan = (label, startMs) => {
  const endMs = performance.now();

  recordPerfSpan({
    depth: 0,
    durationMs: Math.max(0, endMs - startMs),
    endMs,
    label,
    startMs,
  });
};

const mergeNodeUpdate = (node, nodeUpdate) => {
  return {
    ...node,
    ...nodeUpdate,
    transform: {
      ...node.transform,
      ...(nodeUpdate?.transform || {}),
    },
  };
};

const getResizePreviewNode = (editor, nodeId) => {
  const preview = editor.selectionDragPreview;
  const resize = preview?.resize;
  const nodeUpdate = resize?.nodeUpdate;
  const node = editor.getNode(nodeId);

  if (!(node && nodeUpdate && preview.nodeIds?.includes(nodeId))) {
    return null;
  }

  return mergeNodeUpdate(node, nodeUpdate);
};

const selectNodeArtState = (editor, state, nodeId, previewNode = null) => {
  const node = previewNode || editor.getNode(nodeId);

  if (!node) {
    return null;
  }

  if (node.type === "group") {
    return getGroupNodeArtState(editor, state, nodeId);
  }

  const geometry = previewNode
    ? editor.buildPreviewNodeGeometry(previewNode)
    : editor.getNodeRenderGeometry(nodeId);
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
    opacity: getNodeOpacity(node),
    paths: getNodeRenderPaths(editor, node, geometry?.paths || []),
    ready: Boolean(geometry?.ready),
    image: node.type === "image" ? node : null,
    renderMode: "paths",
    renderTree: null,
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
  if (path.closed === false && !path.fill) {
    return "none";
  }

  return path.fill || fill || "none";
};

const getCanvasNodePathStroke = (path, stroke) => {
  return path.stroke || stroke || "none";
};

const getPaintVariableName = (value) => {
  if (
    typeof value !== "string" ||
    value === "none" ||
    value.startsWith("url(")
  ) {
    return null;
  }

  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (Math.imul(31, hash) + value.charCodeAt(index)) % 2_147_483_647;
  }

  return `--pp-paint-${Math.abs(hash).toString(36)}`;
};

const getCanvasPaintValue = (value) => {
  const variableName = getPaintVariableName(value);

  return variableName ? `var(${variableName}, ${value})` : value;
};

const getPaintPreviewStyle = (preview) => {
  const variableName = getPaintVariableName(preview?.baseValue);

  return variableName ? { [variableName]: preview.value } : undefined;
};

const getNodeOpacity = (node) => {
  return typeof node?.opacity === "number" ? node.opacity : 1;
};

const getSvgNodeAncestorOpacityChain = (editor, nodeId) => {
  let opacity = 1;
  let currentNode = editor.getNode(nodeId);

  while (currentNode?.parentId) {
    currentNode = editor.getNode(currentNode.parentId);

    if (!currentNode) {
      break;
    }

    opacity *= getNodeOpacity(currentNode);
  }

  return opacity;
};

const getNodeRenderPaths = (editor, node, paths) => {
  const inheritedOpacity = getSvgNodeAncestorOpacityChain(editor, node.id);
  const nodeOpacity = getNodeOpacity(node);
  const shouldNormalizeNodeOpacity =
    node.type === "path" ||
    (node.type === "vector" && editor.getChildNodeIds(node.id).length === 0);

  return paths.map((path) => ({
    ...path,
    opacity:
      path.opacity == null
        ? undefined
        : (shouldNormalizeNodeOpacity && nodeOpacity
            ? path.opacity / nodeOpacity
            : path.opacity) * inheritedOpacity,
  }));
};

const getSvgNodeTransformBounds = (editor, node) => {
  return getNodeLocalTransformBounds(editor, node.id);
};

const getSvgNodeTransform = (node, bbox) => {
  const x = getNodeX(node) || 0;
  const y = getNodeY(node) || 0;
  const rotation = getNodeRotation(node) || 0;
  const scaleX = getNodeScaleX(node) ?? 1;
  const scaleY = getNodeScaleY(node) ?? 1;

  if (!(bbox && (x || y || rotation || scaleX !== 1 || scaleY !== 1))) {
    return null;
  }

  const matrix = getNodeLocalMatrix(node, bbox);

  return `matrix(${format(matrix.a)} ${format(matrix.b)} ${format(matrix.c)} ${format(matrix.d)} ${format(matrix.e)} ${format(matrix.f)})`;
};

const getSvgNodeTransformChain = (editor, rootNodeId, descendantNodeId) => {
  const nodes: unknown[] = [];
  let currentNode = editor.getNode(descendantNodeId);

  while (currentNode && currentNode.id !== rootNodeId) {
    nodes.push(currentNode);
    currentNode = currentNode.parentId
      ? editor.getNode(currentNode.parentId)
      : null;
  }

  return nodes
    .reverse()
    .map((node) =>
      getSvgNodeTransform(node, getSvgNodeTransformBounds(editor, node))
    )
    .filter(Boolean)
    .join(" ");
};

const getGroupNodePaths = (editor, nodeId) => {
  return editor.getDescendantLeafNodeIds(nodeId).flatMap((descendantNodeId) => {
    const descendantNode = editor.getNode(descendantNodeId);
    const geometry = editor.getNodeRenderGeometry(descendantNodeId);

    if (
      !(
        descendantNode &&
        editor.isNodeEffectivelyVisible(descendantNodeId) &&
        geometry?.paths?.length > 0
      )
    ) {
      return [];
    }

    const nodeTransform = getSvgNodeTransformChain(
      editor,
      nodeId,
      descendantNode.id
    );

    return geometry.paths.map((path, index) => ({
      ...path,
      key: `${descendantNodeId}-${path.key || index}`,
      opacity:
        (path.opacity ?? getNodeOpacity(descendantNode)) *
        getSvgNodeAncestorOpacityChain(editor, descendantNode.id),
      sourceNodeId: descendantNode.id,
      transform: [nodeTransform, path.transform].filter(Boolean).join(" "),
    }));
  });
};

const getGroupNodeRenderTree = (
  editor,
  rootNodeId,
  parentNodeId = rootNodeId
) => {
  return editor.getChildNodeIds(parentNodeId).flatMap((childNodeId) => {
    const childNode = editor.getNode(childNodeId);

    if (!(childNode && editor.isNodeEffectivelyVisible(childNodeId))) {
      return [];
    }

    if (childNode.type === "group") {
      return [
        {
          children: getGroupNodeRenderTree(editor, rootNodeId, childNode.id),
          key: childNode.id,
          opacity: getNodeOpacity(childNode),
          transform: getSvgNodeTransform(
            childNode,
            getSvgNodeTransformBounds(editor, childNode)
          ),
          type: "group",
        },
      ];
    }

    const geometry = editor.getNodeRenderGeometry(childNode.id);

    if (childNode.type === "image" && geometry?.bbox) {
      return [
        {
          baseHeight: childNode.baseHeight,
          baseWidth: childNode.baseWidth,
          baseX: childNode.baseX,
          baseY: childNode.baseY,
          height: childNode.height,
          key: childNode.id,
          nodeId: childNode.id,
          opacity: getNodeOpacity(childNode),
          src: childNode.src,
          tileSources: childNode.tileSources,
          transform: getSvgNodeTransform(childNode, geometry.bbox),
          type: "image",
          width: childNode.width,
        },
      ];
    }

    if (!geometry?.paths?.length) {
      return [];
    }

    const nodeTransform = getSvgNodeTransform(childNode, geometry.bbox);
    const childNodeOpacity = getNodeOpacity(childNode);
    const shouldApplyContainerOpacity =
      childNode.type === "vector" &&
      editor.getChildNodeIds(childNode.id).length > 0;

    return geometry.paths.map((path, index) => ({
      ...path,
      key: `${childNode.id}-${path.key || index}`,
      opacity: shouldApplyContainerOpacity
        ? (path.opacity ?? 1) * childNodeOpacity
        : (path.opacity ?? childNodeOpacity),
      sourceNodeId: childNode.id,
      transform: [nodeTransform, path.transform].filter(Boolean).join(" "),
      type: "path",
    }));
  });
};

const getGroupNodeArtState = (editor, state, nodeId) => {
  const frame = editor.getNodeRenderFrame(nodeId);
  const node = editor.getNode(nodeId);

  if (!(frame?.bounds && node)) {
    return null;
  }

  return {
    bbox: frame.bounds,
    fill: null,
    fillRule: undefined,
    isEditing: state.editingNodeId === nodeId,
    isInteractionProxy: false,
    opacity: getNodeOpacity(node),
    paths: getGroupNodePaths(editor, nodeId),
    ready: true,
    renderMode: "paths",
    renderTree: getGroupNodeRenderTree(editor, nodeId),
    stroke: null,
    strokeLineCap: DEFAULT_VECTOR_STROKE_LINE_CAP,
    strokeLineJoin: DEFAULT_VECTOR_STROKE_LINE_JOIN,
    strokeMiterLimit: DEFAULT_VECTOR_STROKE_MITER_LIMIT,
    strokeWidth: 0,
  };
};

const selectNodeReadyState = (editor, _state, nodeId) => {
  return Boolean(editor.getNode(nodeId));
};

const selectNodeArtInputs = (editor, state, nodeId) => {
  return {
    editingNodeId: state.editingNodeId,
    fontRevision: state.fontRevision,
    node: editor.getNode(nodeId),
    nodes: state.nodes,
  };
};

const getMemoizedNodeArtState = (
  editor,
  nodeId,
  _artInputs,
  _revision = 0,
  previewNode = null
) => {
  return selectNodeArtState(editor, editor.getState(), nodeId, previewNode);
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

const getCanvasInteractionNodeId = (editor, activeTool, nodeId, event) => {
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

const getCanvasHoverNodeId = (editor, event, nodeId) => {
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

const clearSelectionFromUnpaintedNodeHit = ({ activeTool, editor, event }) => {
  if (activeTool !== "pointer") {
    return false;
  }

  event.preventDefault();
  event.stopPropagation();
  editor.clearSelection();

  return true;
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

const shouldIgnoreCanvasNodePointerDown = ({
  activeTool,
  event,
  spacePressed,
}) => {
  return event.button !== 0 || spacePressed || activeTool === "hand";
};

const shouldDeferNodeToolIdleSelection = (editor, activeTool) => {
  return activeTool === "node" && !editor.pathEditingNodeId;
};

const handleNodeToolIdlePointerDown = ({
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
                style={{ left: 0, top: 0 }}
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

const CanvasNodePath = ({
  fill,
  fillRule,
  isEditing,
  path,
  stroke,
  strokeLineCap,
  strokeLineJoin,
  strokeMiterLimit,
  strokeWidth,
}) => {
  const fillValue = getCanvasNodePathFill(path, fill);
  const strokeValue = getCanvasNodePathStroke(path, stroke);

  return (
    <path
      d={path.d}
      fill={fillValue}
      fillRule={path.fillRule || fillRule}
      key={path.key || `${path.transform || "shape"}-${path.d}`}
      opacity={isEditing ? 0 : (path.opacity ?? 1)}
      paintOrder={getVectorPathPaintOrder()}
      pointerEvents="none"
      stroke={strokeValue}
      strokeLinecap={path.strokeLineCap || strokeLineCap}
      strokeLinejoin={path.strokeLineJoin || strokeLineJoin}
      strokeMiterlimit={path.strokeMiterLimit ?? strokeMiterLimit}
      strokeWidth={path.strokeWidth ?? strokeWidth}
      style={{
        fill: getCanvasPaintValue(fillValue),
        stroke: getCanvasPaintValue(strokeValue),
      }}
      transform={path.transform || undefined}
    />
  );
};

const CanvasNodeRenderTree = ({
  fill,
  fillRule,
  isEditing,
  items,
  stroke,
  strokeLineCap,
  strokeLineJoin,
  strokeMiterLimit,
  strokeWidth,
}) => {
  return items.map((item) => {
    if (item.type === "group") {
      return (
        <g
          key={item.key}
          opacity={item.opacity ?? 1}
          transform={item.transform || undefined}
        >
          <CanvasNodeRenderTree
            fill={fill}
            fillRule={fillRule}
            isEditing={isEditing}
            items={item.children || []}
            stroke={stroke}
            strokeLineCap={strokeLineCap}
            strokeLineJoin={strokeLineJoin}
            strokeMiterLimit={strokeMiterLimit}
            strokeWidth={strokeWidth}
          />
        </g>
      );
    }

    if (item.type === "image") {
      return (
        <CanvasRasterImage
          baseHeight={item.baseHeight}
          baseWidth={item.baseWidth}
          baseX={item.baseX}
          baseY={item.baseY}
          height={item.height}
          key={item.key}
          nodeId={item.nodeId}
          opacity={isEditing ? 0 : (item.opacity ?? 1)}
          src={item.src}
          tileSources={item.tileSources}
          transform={item.transform || undefined}
          width={item.width}
        />
      );
    }

    return (
      <CanvasNodePath
        fill={fill}
        fillRule={fillRule}
        isEditing={isEditing}
        key={item.key || `${item.transform || "shape"}-${item.d}`}
        path={item}
        stroke={stroke}
        strokeLineCap={strokeLineCap}
        strokeLineJoin={strokeLineJoin}
        strokeMiterLimit={strokeMiterLimit}
        strokeWidth={strokeWidth}
      />
    );
  });
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
    isInteractionProxy,
    image,
    opacity,
    paintPreview,
    paths,
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
            src={image.src}
            tileSources={image.tileSources}
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
        className="pointer-events-none block h-full w-full overflow-visible"
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

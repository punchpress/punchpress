import {
  MAX_ZOOM,
  MIN_ZOOM,
  measurePerf,
  PERF_SPANS,
  recordPerfSpan,
  round,
} from "@punchpress/engine";
import {
  Profiler,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import InfiniteViewer from "react-infinite-viewer";
import { useEditor } from "../../editor-react/use-editor";
import { useEditorValue } from "../../editor-react/use-editor-value";
import {
  getInteractionTimingStart,
  logInteractionCheckpoint,
  logInteractionNextPaint,
} from "../../performance/interaction-timing-log";
import { shouldDisableCanvasOverlay } from "../../performance/performance-url-flags";
import { useTheme } from "../../theme/theme-provider";
import { DesignerFloatingToolbar, DesignerFrame } from "../designer/designer";
import { CanvasArtboards } from "./canvas-artboards";
import { CanvasBrushCursor } from "./canvas-brush-cursor";
import { getCanvasCursorStyle } from "./canvas-cursor-assets";
import { CanvasCursorCompanion } from "./canvas-cursor-companion";
import { CanvasDotGrid } from "./canvas-dot-grid";
import { CanvasNodes } from "./canvas-nodes";
import { CanvasHostOverlays } from "./canvas-overlay/host-overlays";
import { CanvasStageOverlays } from "./canvas-overlay/stage-overlays";
import { getCanvasDeepLeafNodeIdAtPoint } from "./canvas-overlay/vector-path/canvas-node-hit-target";
import { resolveVectorPenHoverAction } from "./canvas-overlay/vector-path/pen-hover";
import { CanvasTextEditor } from "./canvas-text-editor";
import { startCanvasToolPlacementSession } from "./canvas-tool-placement-session";
import { CanvasToolbar } from "./canvas-toolbar";
import { useCanvasDrop } from "./use-canvas-drop";

const INITIAL_ZOOM = 1;
const CANVAS_STAGE_MARGIN = 80_000;

const recordCanvasReactRender = (...renderStats) => {
  const startTime = renderStats[4];
  const commitTime = renderStats[5];
  const durationMs = Math.max(0, commitTime - startTime);

  if (!(durationMs > 0)) {
    return;
  }

  recordPerfSpan({
    depth: 0,
    durationMs,
    endMs: commitTime,
    label: PERF_SPANS.renderCanvasReact,
    startMs: startTime,
  });
};

const containsPoint = (bounds, point) => {
  return Boolean(
    bounds &&
      point &&
      point.x >= bounds.minX &&
      point.x <= bounds.maxX &&
      point.y >= bounds.minY &&
      point.y <= bounds.maxY
  );
};

const getTopmostVisibleArtboardIdAtPoint = (editor, point) => {
  return (
    [...editor.nodes].reverse().find((node) => {
      return (
        node.type === "artboard" &&
        editor.isNodeEffectivelyVisible(node.id) &&
        containsPoint(editor.getNodeRenderFrame(node.id)?.bounds, point)
      );
    })?.id || null
  );
};

const startCanvasArtboardBodyPress = (editor, event, nodeId) => {
  const wasSelected = editor.isSelected(nodeId);
  const isAdditiveSelection = event.shiftKey;
  const startClientPoint = {
    x: event.clientX,
    y: event.clientY,
  };
  let hasDragged = false;

  const handlePointerMove = (moveEvent) => {
    hasDragged =
      hasDragged ||
      Math.hypot(
        moveEvent.clientX - startClientPoint.x,
        moveEvent.clientY - startClientPoint.y
      ) >= 3;
  };

  const handlePointerEnd = () => {
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointercancel", handlePointerEnd);
    window.removeEventListener("pointerup", handlePointerEnd);

    if (hasDragged) {
      return;
    }

    if (isAdditiveSelection) {
      editor.toggleSelection(nodeId);
      return;
    }

    if (!wasSelected) {
      editor.select(nodeId);
    }
  };

  window.addEventListener("pointermove", handlePointerMove);
  window.addEventListener("pointercancel", handlePointerEnd);
  window.addEventListener("pointerup", handlePointerEnd);
};

const stopPathEditingFromCanvasPress = (editor, activeTool) => {
  if (activeTool === "node") {
    editor.setActiveTool("pointer");
    return;
  }

  editor.stopPathEditing();
};

const logCanvasPointerDownAccepted = ({
  activeTool,
  editor,
  event,
  timingStartedAt,
}) => {
  logInteractionCheckpoint("pointer.down.accepted", timingStartedAt, {
    activeTool,
    selectedNodeCount: editor.selectedNodeIds.length,
    target: event.target instanceof Element ? event.target.tagName : null,
  });
};

const logCanvasPointerDownDispatched = (editor, timingStartedAt) => {
  logInteractionCheckpoint("pointer.down.dispatched", timingStartedAt, {
    selectedNodeCount: editor.selectedNodeIds.length,
  });
  logInteractionNextPaint("pointer.down", timingStartedAt, () => ({
    selectedNodeCount: editor.selectedNodeIds.length,
  }));
};

const shouldIgnoreCanvasPointerTarget = (event, activeTool) => {
  if (!(event.target instanceof Element)) {
    return true;
  }

  if (!event.target.closest(".canvas-surface")) {
    return true;
  }

  if (
    event.target.closest("[data-node-id], [data-testid='canvas-text-input']")
  ) {
    return true;
  }

  const isRasterTool = activeTool === "brush" || activeTool === "eraser";

  return Boolean(
    !isRasterTool &&
      event.target.closest(
        [".canvas-moveable", "[data-artboard-body]"].join(",")
      )
  );
};

const isTransformOverlayWheelTarget = (target) => {
  return Boolean(
    target instanceof Element && target.closest(".canvas-moveable")
  );
};

const getWheelScrollDelta = (event, zoom) => {
  const normalizedZoom = Math.max(zoom || INITIAL_ZOOM, MIN_ZOOM);
  const deltaX = event.shiftKey && !event.deltaX ? event.deltaY : event.deltaX;
  const deltaY = event.shiftKey && !event.deltaX ? 0 : event.deltaY;

  return {
    x: deltaX / normalizedZoom,
    y: deltaY / normalizedZoom,
  };
};

const markViewportInteraction = (editor, timeoutRef) => {
  editor.setViewportInteracting(true);

  if (timeoutRef.current !== null) {
    window.clearTimeout(timeoutRef.current);
  }

  timeoutRef.current = window.setTimeout(() => {
    timeoutRef.current = null;
    editor.setViewportInteracting(false);
  }, 120);
};

const getCanvasPoint = (viewer, host, clientX, clientY, zoom) => {
  if (!(viewer && host)) {
    return { x: 0, y: 0 };
  }

  const rect = host.getBoundingClientRect();

  return {
    x: viewer.getScrollLeft() + (clientX - rect.left) / zoom,
    y: viewer.getScrollTop() + (clientY - rect.top) / zoom,
  };
};

const syncHostPenCursorMode = (
  host,
  activeTool,
  editor,
  penDirectSelectionMode
) => {
  if (!(host instanceof HTMLElement)) {
    return;
  }

  if (activeTool !== "pen" || penDirectSelectionMode) {
    delete host.dataset.penCursorMode;
    return;
  }

  const nextCursorMode = resolveVectorPenHoverAction(
    editor.getPenHoverState()
  )?.cursorMode;

  if (nextCursorMode && nextCursorMode !== "default") {
    host.dataset.penCursorMode = nextCursorMode;
    return;
  }

  delete host.dataset.penCursorMode;
};

export const Canvas = () => {
  const editor = useEditor();
  useTheme();
  const activeTool = useEditorValue((_, state) => state.activeTool);
  const pathEditingNodeId = useEditorValue(
    (_, state) => state.pathEditingNodeId
  );
  const penDirectSelectionMode = useEditorValue((_, state) => {
    return (
      state.activeTool === "pen" && state.penDirectSelectionModifierPressed
    );
  });
  const penPointTypeToggleModifierPressed = useEditorValue((_, state) => {
    return state.penPointTypeToggleModifierPressed;
  });
  const spacePressed = useEditorValue((_, state) => state.spacePressed);
  const zoom = useEditorValue((_, state) => state.viewport.zoom);
  const shouldRenderOverlay = !shouldDisableCanvasOverlay();

  const viewerRef = useRef(null);
  const hostRef = useRef(null);
  const viewportInteractionTimeoutRef = useRef<number | null>(null);
  const lastPenHoverClientPointRef = useRef<{ x: number; y: number } | null>(
    null
  );
  const [hostElement, setHostElement] = useState<HTMLDivElement | null>(null);

  const handleHostRef = useCallback((nextHostElement) => {
    hostRef.current = nextHostElement;
    setHostElement(nextHostElement);
  }, []);

  useLayoutEffect(() => {
    const viewer = viewerRef.current;
    if (!(viewer && hostElement)) {
      return;
    }

    editor.viewerRef = viewer;
    editor.hostRef = hostElement;

    const viewport = editor.viewport;

    viewer.setTo?.({
      x: viewport.x ?? 0,
      y: viewport.y ?? 0,
      zoom: viewport.zoom ?? INITIAL_ZOOM,
    });
    editor.setViewport({
      x: viewport.x ?? 0,
      y: viewport.y ?? 0,
      zoom: viewport.zoom ?? INITIAL_ZOOM,
    });

    return () => {
      if (viewportInteractionTimeoutRef.current !== null) {
        window.clearTimeout(viewportInteractionTimeoutRef.current);
        viewportInteractionTimeoutRef.current = null;
      }
      editor.setViewportInteracting(false);
      editor.viewerRef = null;
      editor.hostRef = null;
    };
  }, [editor, hostElement]);

  useEffect(() => {
    syncHostPenCursorMode(
      hostRef.current,
      activeTool,
      editor,
      penDirectSelectionMode
    );

    if (activeTool !== "pen") {
      lastPenHoverClientPointRef.current = null;
      return;
    }

    if (penDirectSelectionMode || spacePressed) {
      editor.dispatchCanvasPointerLeave({});
      return;
    }

    const lastClientPoint = lastPenHoverClientPointRef.current;

    if (!lastClientPoint) {
      return;
    }

    const point = getCanvasPoint(
      viewerRef.current,
      hostRef.current,
      lastClientPoint.x,
      lastClientPoint.y,
      zoom
    );

    editor.dispatchCanvasPointerMove({
      event: {
        altKey: penPointTypeToggleModifierPressed,
      },
      point: {
        x: round(point.x, 2),
        y: round(point.y, 2),
      },
    });
    syncHostPenCursorMode(
      hostRef.current,
      activeTool,
      editor,
      penDirectSelectionMode
    );
  }, [
    activeTool,
    editor,
    penDirectSelectionMode,
    penPointTypeToggleModifierPressed,
    spacePressed,
    zoom,
  ]);

  const handleScroll = useCallback(
    (event) => {
      const viewer = viewerRef.current;
      markViewportInteraction(editor, viewportInteractionTimeoutRef);

      editor.setViewport({
        x: viewer?.getScrollLeft?.() ?? editor.viewport.x ?? 0,
        y: viewer?.getScrollTop?.() ?? editor.viewport.y ?? 0,
        zoom: event.zoomX,
      });
      editor.onViewportChange?.();
    },
    [editor]
  );
  const getCanvasDropPoint = useCallback(
    (clientX, clientY) =>
      getCanvasPoint(
        viewerRef.current,
        hostRef.current,
        clientX,
        clientY,
        zoom
      ),
    [zoom]
  );
  const { handleCanvasDragOver, handleCanvasDrop } = useCanvasDrop({
    editor,
    getCanvasPoint: getCanvasDropPoint,
  });
  const handleCanvasWheel = useCallback(
    (event) => {
      const isZoomWheel = event.metaKey || event.ctrlKey;

      if (!isZoomWheel) {
        if (!isTransformOverlayWheelTarget(event.target)) {
          return;
        }

        const viewer = viewerRef.current;

        if (!viewer) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        markViewportInteraction(editor, viewportInteractionTimeoutRef);

        const delta = getWheelScrollDelta(event, editor.viewport.zoom);
        viewer.scrollBy?.(delta.x, delta.y);
        editor.setViewport({
          x: viewer.getScrollLeft?.() ?? editor.viewport.x ?? 0,
          y: viewer.getScrollTop?.() ?? editor.viewport.y ?? 0,
          zoom: editor.viewport.zoom ?? INITIAL_ZOOM,
        });
        editor.onViewportChange?.();
        return;
      }

      const viewer = viewerRef.current;
      const host = hostRef.current;
      if (!(viewer && host)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      markViewportInteraction(editor, viewportInteractionTimeoutRef);

      editor.zoomViewportFromWheel({
        clientX: event.clientX,
        clientY: event.clientY,
        deltaY: event.deltaY,
      });
    },
    [editor]
  );
  const handleCanvasPointerDown = useCallback(
    (event) => {
      const timingStartedAt = getInteractionTimingStart();

      if (spacePressed || activeTool === "hand") {
        return;
      }

      if (
        pathEditingNodeId &&
        event.target instanceof Element &&
        event.target.closest(".canvas-vector-paper")
      ) {
        return;
      }

      if (shouldIgnoreCanvasPointerTarget(event, activeTool)) {
        return;
      }

      const point = getCanvasPoint(
        viewerRef.current,
        hostRef.current,
        event.clientX,
        event.clientY,
        zoom
      );

      logCanvasPointerDownAccepted({
        activeTool,
        editor,
        event,
        timingStartedAt,
      });

      if (pathEditingNodeId && activeTool !== "pen") {
        event.preventDefault();
        event.stopPropagation();
        stopPathEditingFromCanvasPress(editor, activeTool);
        return;
      }

      const hitNodeId =
        activeTool === "pointer"
          ? measurePerf(PERF_SPANS.pointerDownHitTestDeep, () =>
              getCanvasDeepLeafNodeIdAtPoint(
                editor,
                event.clientX,
                event.clientY
              )
            )
          : null;
      const artboardBodyNodeId =
        activeTool === "pointer" && !hitNodeId
          ? measurePerf(PERF_SPANS.pointerDownHitTestArtboard, () =>
              getTopmostVisibleArtboardIdAtPoint(editor, point)
            )
          : null;

      if (artboardBodyNodeId) {
        startCanvasArtboardBodyPress(editor, event, artboardBodyNodeId);
        return;
      }

      startCanvasToolPlacementSession({
        editor,
        event,
        getCanvasPoint: (clientX, clientY) =>
          getCanvasPoint(
            viewerRef.current,
            hostRef.current,
            clientX,
            clientY,
            zoom
          ),
        session: editor.dispatchCanvasPointerDown({
          event,
          point: {
            x: round(point.x, 2),
            y: round(point.y, 2),
          },
        }),
      });
      logCanvasPointerDownDispatched(editor, timingStartedAt);
      syncHostPenCursorMode(
        hostRef.current,
        activeTool,
        editor,
        penDirectSelectionMode
      );
    },
    [
      activeTool,
      editor,
      pathEditingNodeId,
      penDirectSelectionMode,
      spacePressed,
      zoom,
    ]
  );
  const handleCanvasPointerLeave = useCallback(() => {
    lastPenHoverClientPointRef.current = null;

    if (activeTool !== "pen") {
      return;
    }

    editor.dispatchCanvasPointerLeave({});
    syncHostPenCursorMode(
      hostRef.current,
      activeTool,
      editor,
      penDirectSelectionMode
    );
  }, [activeTool, editor, penDirectSelectionMode]);
  const handleCanvasPointerMove = useCallback(
    (event) => {
      if (spacePressed || activeTool !== "pen" || event.buttons !== 0) {
        return;
      }

      if (penDirectSelectionMode) {
        editor.dispatchCanvasPointerLeave({ event });
        syncHostPenCursorMode(
          hostRef.current,
          activeTool,
          editor,
          penDirectSelectionMode
        );
        return;
      }

      if (!(event.target instanceof Element)) {
        lastPenHoverClientPointRef.current = null;
        editor.dispatchCanvasPointerLeave({ event });
        return;
      }

      if (
        !event.target.closest(
          [".canvas-surface", ".canvas-node", ".canvas-vector-paper"].join(",")
        )
      ) {
        lastPenHoverClientPointRef.current = null;
        editor.dispatchCanvasPointerLeave({ event });
        return;
      }

      lastPenHoverClientPointRef.current = {
        x: event.clientX,
        y: event.clientY,
      };

      const point = getCanvasPoint(
        viewerRef.current,
        hostRef.current,
        event.clientX,
        event.clientY,
        zoom
      );

      editor.dispatchCanvasPointerMove({
        event,
        point: {
          x: round(point.x, 2),
          y: round(point.y, 2),
        },
      });
      syncHostPenCursorMode(
        hostRef.current,
        activeTool,
        editor,
        penDirectSelectionMode
      );
    },
    [activeTool, editor, penDirectSelectionMode, spacePressed, zoom]
  );

  return (
    <DesignerFrame>
      <div
        className="canvas-host relative flex min-h-0 flex-1"
        data-panning={
          spacePressed || activeTool === "hand" ? "true" : undefined
        }
        data-tool={activeTool}
        onDragOverCapture={handleCanvasDragOver}
        onDropCapture={handleCanvasDrop}
        onPointerDownCapture={handleCanvasPointerDown}
        onPointerLeave={handleCanvasPointerLeave}
        onPointerMoveCapture={handleCanvasPointerMove}
        onWheelCapture={handleCanvasWheel}
        ref={handleHostRef}
        style={getCanvasCursorStyle()}
      >
        <InfiniteViewer
          className="canvas-surface relative z-[1] h-full w-full"
          margin={CANVAS_STAGE_MARGIN}
          onScroll={handleScroll}
          ref={viewerRef}
          threshold={0}
          useAutoZoom
          useMouseDrag={spacePressed || activeTool === "hand"}
          useWheelPinch={false}
          useWheelScroll
          wheelPinchKey="meta"
          zoom={zoom}
          zoomRange={[MIN_ZOOM, MAX_ZOOM]}
        >
          <div
            className="relative h-full w-full overflow-visible border-0 bg-transparent shadow-none"
            data-testid="canvas-stage"
          >
            <Profiler id="canvas" onRender={recordCanvasReactRender}>
              <CanvasDotGrid
                originX={-CANVAS_STAGE_MARGIN}
                originY={-CANVAS_STAGE_MARGIN}
                stageMargin={CANVAS_STAGE_MARGIN}
                zoom={zoom}
              />
              <CanvasArtboards />
              <CanvasNodes />
              <CanvasStageOverlays />
              <CanvasTextEditor />
            </Profiler>
          </div>
        </InfiniteViewer>

        {/*
          Host-anchored screen-space layer for raster store surfaces (one
          viewport-sized canvas per brushed node, in document order). Mounting
          the device-resolution canvas inside a node shell with an inverse
          transform re-enters Blink's ~16384 px paint cull in the shell's
          local space, truncating the surface mid-viewport at deep zoom-out;
          this axis-aligned layer never does.
        */}
        <div
          className="pointer-events-none absolute inset-0 z-[1] overflow-hidden"
          data-raster-surface-layer="true"
          ref={(element) => {
            editor.rasterSurfaceLayer = element;
          }}
        />

        <DesignerFloatingToolbar>
          <CanvasToolbar />
        </DesignerFloatingToolbar>

        <CanvasCursorCompanion hostElement={hostElement} />
        <CanvasBrushCursor hostElement={hostElement} />

        {shouldRenderOverlay ? <CanvasHostOverlays /> : null}
      </div>
    </DesignerFrame>
  );
};

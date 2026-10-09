import {
  MAX_ZOOM,
  MIN_ZOOM,
  measurePerf,
  PERF_SPANS,
  recordPerfSpan,
  round,
} from "@punchpress/engine";
import { Profiler, useCallback, useRef, useState } from "react";
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
import { getCanvasClientPoint } from "./canvas-client-point";
import { getCanvasCursorStyle } from "./canvas-cursor-assets";
import { CanvasCursorCompanion } from "./canvas-cursor-companion";
import { CanvasDotGrid } from "./canvas-dot-grid";
import { CanvasNodes } from "./canvas-nodes";
import { CanvasHostOverlays } from "./canvas-overlay/host-overlays";
import { CanvasStageOverlays } from "./canvas-overlay/stage-overlays";
import { getCanvasDeepLeafNodeIdAtPoint } from "./canvas-overlay/vector-path/canvas-node-hit-target";
import { CanvasPixelGrid } from "./canvas-pixel-grid";
import { CanvasTextEditor } from "./canvas-text-editor";
import { startCanvasToolPlacementSession } from "./canvas-tool-placement-session";
import { CanvasToolbar } from "./canvas-toolbar";
import { useCanvasDrop } from "./use-canvas-drop";
import {
  syncHostPenCursorMode,
  useCanvasPenHover,
} from "./use-canvas-pen-hover";
import { useCanvasViewer } from "./use-canvas-viewer";
import { useCanvasZoomRaster } from "./use-canvas-zoom-raster";

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

  if (event.target.closest("[data-raster-crop-overlay]")) {
    return true;
  }

  if (
    event.target.closest("[data-node-id], [data-testid='canvas-text-input']")
  ) {
    return true;
  }

  const isRasterTool = activeTool === "brush" || activeTool === "eraser";
  const isPlacementTool =
    isRasterTool ||
    activeTool === "pen" ||
    activeTool === "shape" ||
    activeTool === "text";

  // Placement tools create content inside artboards, so the artboard body
  // must not swallow their presses; selection-style tools defer to the
  // artboard press handling instead.
  if (!isPlacementTool && event.target.closest("[data-artboard-body]")) {
    return true;
  }

  return Boolean(!isRasterTool && event.target.closest(".canvas-moveable"));
};

const commitCropFromOutsidePress = (editor, event) => {
  if (
    editor.rasterCropSession &&
    event.target instanceof Element &&
    !event.target.closest("[data-raster-crop-overlay]")
  ) {
    editor.commitCrop();
  }
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
  const spacePressed = useEditorValue((_, state) => state.spacePressed);
  const shouldRenderOverlay = !shouldDisableCanvasOverlay();

  const hostRef = useRef<HTMLDivElement | null>(null);
  const [hostElement, setHostElement] = useState<HTMLDivElement | null>(null);
  const { handlePanEnd, handleScroll, handleWheel, viewerRef } =
    useCanvasViewer(hostElement);
  useCanvasZoomRaster(hostElement);
  const penHover = useCanvasPenHover({
    activeTool,
    hostRef,
    penDirectSelectionMode,
    spacePressed,
  });

  const handleHostRef = useCallback((nextHostElement) => {
    hostRef.current = nextHostElement;
    setHostElement(nextHostElement);
  }, []);

  const getCanvasDropPoint = useCallback(
    (clientX, clientY) => getCanvasClientPoint(editor, clientX, clientY),
    [editor]
  );
  const { handleCanvasDragOver, handleCanvasDrop } = useCanvasDrop({
    editor,
    getCanvasPoint: getCanvasDropPoint,
  });
  const handleCanvasPointerDown = useCallback(
    (event) => {
      const timingStartedAt = getInteractionTimingStart();

      if (spacePressed || activeTool === "hand") {
        return;
      }

      commitCropFromOutsidePress(editor, event);

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

      const point = getCanvasClientPoint(editor, event.clientX, event.clientY);

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
          getCanvasClientPoint(editor, clientX, clientY),
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
    ]
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
        onPointerLeave={penHover.handlePointerLeave}
        onPointerMoveCapture={penHover.handlePointerMove}
        onWheelCapture={handleWheel}
        ref={handleHostRef}
        style={getCanvasCursorStyle()}
      >
        {/* No `zoom` prop: the wrapper replays every supplied property on
            each React update, which would snap the camera back. The engine
            moves the viewer imperatively. */}
        <InfiniteViewer
          className="canvas-surface relative z-[1] h-full w-full"
          margin={CANVAS_STAGE_MARGIN}
          onDragEnd={handlePanEnd}
          onScroll={handleScroll}
          ref={viewerRef}
          threshold={0}
          useAutoZoom
          useMouseDrag={spacePressed || activeTool === "hand"}
          useWheelPinch={false}
          useWheelScroll
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
              />
              <CanvasArtboards />
              <CanvasNodes />
              <CanvasPixelGrid />
              <CanvasStageOverlays />
              <CanvasTextEditor />
            </Profiler>
          </div>
        </InfiniteViewer>

        <DesignerFloatingToolbar>
          <CanvasToolbar />
        </DesignerFloatingToolbar>

        <CanvasCursorCompanion hostElement={hostElement} />
        <CanvasBrushCursor hostElement={hostElement} />

        {shouldRenderOverlay && hostElement ? <CanvasHostOverlays /> : null}
      </div>
    </DesignerFrame>
  );
};

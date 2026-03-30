import { MAX_ZOOM, MIN_ZOOM, round } from "@punchpress/engine";
import { useCallback, useEffect, useRef } from "react";
import InfiniteViewer from "react-infinite-viewer";
import { useEditor } from "../../editor-react/use-editor";
import { useEditorValue } from "../../editor-react/use-editor-value";
import { shouldDisableCanvasOverlay } from "../../performance/performance-url-flags";
import { useTheme } from "../../theme/theme-provider";
import { DesignerFloatingToolbar, DesignerFrame } from "../designer/designer";
import { getCanvasCursorStyle } from "./canvas-cursor-assets";
import { CanvasDotGrid } from "./canvas-dot-grid";
import { CanvasNodes } from "./canvas-nodes";
import { CanvasHoverPreview } from "./canvas-overlay/canvas-hover-preview";
import { CanvasOverlay } from "./canvas-overlay/canvas-overlay";
import { CanvasTextEditor } from "./canvas-text-editor";
import { startCanvasToolPlacementSession } from "./canvas-tool-placement-session";
import { CanvasToolbar } from "./canvas-toolbar";

const INITIAL_ZOOM = 1;
const CANVAS_STAGE_MARGIN = 2400;
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

export const Canvas = () => {
  const editor = useEditor();
  useTheme();
  const activeTool = useEditorValue((_, state) => state.activeTool);
  const spacePressed = useEditorValue((_, state) => state.spacePressed);
  const zoom = useEditorValue((_, state) => state.viewport.zoom);
  const shouldRenderOverlay = !shouldDisableCanvasOverlay();

  const viewerRef = useRef(null);
  const hostRef = useRef(null);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) {
      return;
    }

    editor.viewerRef = viewer;
    editor.hostRef = hostRef.current;

    const rafId = window.requestAnimationFrame(() => {
      viewer.setTo?.({
        x: 0,
        y: 0,
        zoom: INITIAL_ZOOM,
      });
      editor.setViewportZoom(INITIAL_ZOOM);
    });

    return () => {
      window.cancelAnimationFrame(rafId);
      editor.viewerRef = null;
      editor.hostRef = null;
    };
  }, [editor]);

  const handleScroll = useCallback(
    (event) => {
      editor.setViewportZoom(event.zoomX);
      editor.onViewportChange?.();
    },
    [editor]
  );
  const handleCanvasWheel = useCallback(
    (event) => {
      if (!(event.metaKey || event.ctrlKey)) {
        return;
      }

      const viewer = viewerRef.current;
      const host = hostRef.current;
      if (!(viewer && host)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
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
      if (spacePressed || activeTool === "hand") {
        return;
      }

      if (
        !(
          event.target instanceof Element &&
          event.target.closest(".canvas-surface")
        ) ||
        event.target.closest(
          [
            "[data-node-id]",
            ".canvas-moveable",
            "[data-testid='canvas-text-input']",
          ].join(",")
        )
      ) {
        return;
      }

      const point = getCanvasPoint(
        viewerRef.current,
        hostRef.current,
        event.clientX,
        event.clientY,
        zoom
      );

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
    },
    [activeTool, editor, spacePressed, zoom]
  );

  return (
    <DesignerFrame>
      <div
        className="canvas-host relative flex min-h-0 flex-1"
        data-panning={
          spacePressed || activeTool === "hand" ? "true" : undefined
        }
        data-tool={activeTool}
        onPointerDownCapture={handleCanvasPointerDown}
        onWheelCapture={handleCanvasWheel}
        ref={hostRef}
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
            <CanvasDotGrid
              originX={-CANVAS_STAGE_MARGIN}
              originY={-CANVAS_STAGE_MARGIN}
              stageMargin={CANVAS_STAGE_MARGIN}
              zoom={zoom}
            />
            <CanvasHoverPreview />
            <CanvasNodes />
            <CanvasTextEditor />
          </div>
        </InfiniteViewer>

        <DesignerFloatingToolbar>
          <CanvasToolbar />
        </DesignerFloatingToolbar>

        {shouldRenderOverlay ? <CanvasOverlay /> : null}
      </div>
    </DesignerFrame>
  );
};

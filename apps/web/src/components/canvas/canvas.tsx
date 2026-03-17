import { MAX_ZOOM, MIN_ZOOM, round } from "@punchpress/engine";
import { useCallback, useEffect, useRef } from "react";
import InfiniteViewer from "react-infinite-viewer";
import { useEditor } from "../../editor-react/use-editor";
import { useEditorValue } from "../../editor-react/use-editor-value";
import { DesignerFloatingToolbar, DesignerFrame } from "../designer/designer";
import { CanvasNodes } from "./canvas-nodes";
import { CanvasOverlay } from "./canvas-overlay/canvas-overlay";
import { CanvasTextEditor } from "./canvas-text-editor";
import { CanvasToolbar } from "./canvas-toolbar";

const INITIAL_ZOOM = 1;

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
  const activeTool = useEditorValue((_, state) => state.activeTool);
  const spacePressed = useEditorValue((_, state) => state.spacePressed);
  const zoom = useEditorValue((_, state) => state.viewport.zoom);

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

      editor.dispatchCanvasPointerDown({
        event,
        point: {
          x: round(point.x, 2),
          y: round(point.y, 2),
        },
      });
    },
    [activeTool, editor, spacePressed, zoom]
  );

  return (
    <DesignerFrame>
      <div
        className="relative flex min-h-0 flex-1"
        data-panning={
          spacePressed || activeTool === "hand" ? "true" : undefined
        }
        data-tool={activeTool}
        onPointerDownCapture={handleCanvasPointerDown}
        ref={hostRef}
      >
        <InfiniteViewer
          className="canvas-surface h-full w-full bg-[var(--designer-bg)]"
          margin={2400}
          onScroll={handleScroll}
          ref={viewerRef}
          threshold={0}
          useAutoZoom
          useMouseDrag={spacePressed || activeTool === "hand"}
          useWheelScroll
          wheelPinchKey="meta"
          zoom={zoom}
          zoomRange={[MIN_ZOOM, MAX_ZOOM]}
        >
          <div
            className="relative h-full w-full overflow-visible border-0 bg-transparent shadow-none"
            data-testid="canvas-stage"
          >
            <CanvasNodes />
            <CanvasTextEditor />
          </div>
        </InfiniteViewer>

        <DesignerFloatingToolbar>
          <CanvasToolbar />
        </DesignerFloatingToolbar>

        <CanvasOverlay />
      </div>
    </DesignerFrame>
  );
};

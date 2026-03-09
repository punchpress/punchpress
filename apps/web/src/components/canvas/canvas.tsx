import { useCallback, useEffect, useRef, useState } from "react";
import InfiniteViewer from "react-infinite-viewer";
import { MAX_ZOOM, MIN_ZOOM } from "../../editor/constants";
import { round } from "../../editor/primitives/math";
import { useEditor } from "../../editor/use-editor";
import { useEditorValue } from "../../editor/use-editor-value";
import { DesignerFloatingToolbar, DesignerFrame } from "../designer/designer";
import { CanvasNodes } from "./canvas-nodes";
import { CanvasOverlay } from "./canvas-overlay";
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
  const zoom = useEditorValue((_, state) => state.viewport.zoom);

  const [spacePressed, setSpacePressed] = useState(false);
  const viewerRef = useRef(null);
  const hostRef = useRef(null);

  useEffect(() => {
    editor.onSpacePressedChange = setSpacePressed;

    return () => {
      editor.onSpacePressedChange = null;
    };
  }, [editor]);

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

  return (
    <DesignerFrame>
      <div
        className="relative flex min-h-0 flex-1"
        data-panning={
          spacePressed || activeTool === "hand" ? "true" : undefined
        }
        data-tool={activeTool}
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
            onPointerDown={(event) => {
              if (event.target !== event.currentTarget) {
                return;
              }

              if (spacePressed || activeTool === "hand") {
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
            }}
          >
            <CanvasNodes spacePressed={spacePressed} />
            <CanvasTextEditor />
          </div>
        </InfiniteViewer>

        <DesignerFloatingToolbar>
          <CanvasToolbar />
        </DesignerFloatingToolbar>

        <CanvasOverlay spacePressed={spacePressed} />
      </div>
    </DesignerFrame>
  );
};

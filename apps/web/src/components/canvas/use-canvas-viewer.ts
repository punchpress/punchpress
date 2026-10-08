import { MIN_ZOOM } from "@punchpress/engine";
import { useCallback, useLayoutEffect, useRef } from "react";
import { useEditor } from "../../editor-react/use-editor";

const GESTURE_IDLE_MS = 120;

// Canvas adapter for react-infinite-viewer. It attaches the viewer to the
// engine, reports native viewer scrolls (wheel pan, hand drag) as viewport
// gestures that settle after a short idle, and routes wheel pinch through the
// engine. Camera policy (clamping, echo handling, publication) is the engine's.
export const useCanvasViewer = (hostElement: HTMLDivElement | null) => {
  const editor = useEditor();
  const viewerRef = useRef(null);
  const idleTimeoutRef = useRef<number | null>(null);
  const wheelGestureModeRef = useRef<"pan" | "zoom" | null>(null);

  const markGesture = useCallback(() => {
    editor.setViewportGestureActive(true);

    if (idleTimeoutRef.current !== null) {
      window.clearTimeout(idleTimeoutRef.current);
    }

    idleTimeoutRef.current = window.setTimeout(() => {
      idleTimeoutRef.current = null;
      wheelGestureModeRef.current = null;
      editor.setViewportGestureActive(false);
    }, GESTURE_IDLE_MS);
  }, [editor]);

  useLayoutEffect(() => {
    const viewer = viewerRef.current;

    if (!(viewer && hostElement)) {
      return;
    }

    editor.attachViewport({ host: hostElement, viewer });

    return () => {
      if (idleTimeoutRef.current !== null) {
        window.clearTimeout(idleTimeoutRef.current);
        idleTimeoutRef.current = null;
      }

      wheelGestureModeRef.current = null;
      editor.detachViewport(viewer);
    };
  }, [editor, hostElement]);

  const handleScroll = useCallback(() => {
    if (editor.syncViewportFromViewer()) {
      markGesture();
    }
  }, [editor, markGesture]);

  const handlePanEnd = useCallback(() => {
    queueMicrotask(() => {
      // InfiniteViewer applies pointer velocity as unscaled world-space
      // momentum. Stop that fling so drag panning remains screen-space.
      viewerRef.current?.scrollBy?.(0, 0);
    });
  }, []);

  const handleWheel = useCallback(
    (event) => {
      const viewer = viewerRef.current;

      if (!viewer) {
        return;
      }

      const isPinchZoom = event.ctrlKey && !event.altKey && !event.metaKey;
      const isZoomWheel = isPinchZoom || wheelGestureModeRef.current === "zoom";

      wheelGestureModeRef.current = isZoomWheel ? "zoom" : "pan";
      markGesture();

      if (!isZoomWheel) {
        // The viewer scrolls ordinary wheel pans itself; transform handles
        // swallow wheel events, so pan the viewer for them.
        if (!isTransformOverlayWheelTarget(event.target)) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        const delta = getWheelScrollDelta(event, editor.zoom);
        viewer.scrollBy?.(delta.x, delta.y);
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (!isPinchZoom) {
        return;
      }

      editor.zoomViewportFromWheel({
        clientX: event.clientX,
        clientY: event.clientY,
        deltaY: event.deltaY,
      });
    },
    [editor, markGesture]
  );

  return { handlePanEnd, handleScroll, handleWheel, viewerRef };
};

const isTransformOverlayWheelTarget = (target) => {
  return Boolean(
    target instanceof Element && target.closest(".canvas-moveable")
  );
};

const getWheelScrollDelta = (event, zoom) => {
  const normalizedZoom = Math.max(zoom || 1, MIN_ZOOM);
  const deltaX = event.shiftKey && !event.deltaX ? event.deltaY : event.deltaX;
  const deltaY = event.shiftKey && !event.deltaX ? 0 : event.deltaY;

  return {
    x: deltaX / normalizedZoom,
    y: deltaY / normalizedZoom,
  };
};

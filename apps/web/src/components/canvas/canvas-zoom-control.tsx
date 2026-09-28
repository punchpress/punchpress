import { MAX_ZOOM, MIN_ZOOM } from "@punchpress/engine";
import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { useEditor } from "../../editor-react/use-editor";

const ZOOM_DOUBLE_DISTANCE = 120;

export const CanvasZoomControl = () => {
  const editor = useEditor();
  useSyncExternalStore(
    useCallback(
      (listener) => editor.subscribeViewportPresentation(listener),
      [editor]
    ),
    useCallback(() => editor.getViewportPresentationRevision(), [editor]),
    () => 0
  );
  const zoom = editor.zoom;
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startZoom: number;
  } | null>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const percent = Math.round(zoom * 100);

  const stopScrubbing = () => {
    dragRef.current = null;
    setIsScrubbing(false);
    editor.setViewportInteracting(false);
  };

  return (
    <Button
      aria-label="Canvas zoom"
      aria-valuemax={MAX_ZOOM * 100}
      aria-valuemin={MIN_ZOOM * 100}
      aria-valuenow={percent}
      aria-valuetext={`${percent}%`}
      className="!cursor-ew-resize min-w-12 touch-none select-none px-2 text-muted-foreground tabular-nums"
      data-scrubbing={isScrubbing ? "true" : undefined}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
          event.preventDefault();
          editor.zoomOut();
        } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
          event.preventDefault();
          editor.zoomIn();
        } else if (event.key === "Home") {
          event.preventDefault();
          editor.zoomTo(MIN_ZOOM);
        } else if (event.key === "End") {
          event.preventDefault();
          editor.zoomTo(MAX_ZOOM);
        }
      }}
      onLostPointerCapture={stopScrubbing}
      onPointerCancel={stopScrubbing}
      onPointerDown={(event) => {
        if (event.button !== 0) {
          return;
        }

        event.preventDefault();
        event.currentTarget.focus();
        event.currentTarget.setPointerCapture(event.pointerId);
        dragRef.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startZoom: zoom,
        };
        editor.setViewportInteracting(true);
        setIsScrubbing(true);
      }}
      onPointerMove={(event) => {
        const drag = dragRef.current;

        if (!drag || drag.pointerId !== event.pointerId) {
          return;
        }

        editor.zoomTo(
          drag.startZoom *
            2 ** ((event.clientX - drag.startX) / ZOOM_DOUBLE_DISTANCE)
        );
      }}
      onPointerUp={stopScrubbing}
      role="slider"
      size="sm"
      title="Drag horizontally to zoom"
      type="button"
      variant="ghost"
    >
      {percent}%
    </Button>
  );
};

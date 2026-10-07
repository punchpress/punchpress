import { MAX_ZOOM, MIN_ZOOM } from "../constants";
import { clamp } from "../primitives/math";

export const moveViewportTo = (editor, viewport) => {
  editor.cancelPendingViewportFocus();

  return applyViewport(editor, viewport);
};

// Programmatic moves echo through the viewer's scroll handler, which marks the
// viewport as interacting and defers store writes. A deferred write leaves the
// controlled viewer props stale, so a later render replays the old camera.
// Write the store with the camera and end the echo-only interaction together.
export const applyViewport = (editor, viewport) => {
  const viewer = editor.viewerRef;

  if (!viewer) {
    return false;
  }

  const current = editor.viewport;
  const nextViewport = {
    x: viewport.x ?? current.x ?? 0,
    y: viewport.y ?? current.y ?? 0,
    zoom: clamp(viewport.zoom ?? current.zoom ?? 1, MIN_ZOOM, MAX_ZOOM),
  };
  const wasInteracting = editor.viewportInteracting;

  viewer.setTo?.(nextViewport);
  editor.setViewport(nextViewport);
  editor.getState().setViewport(nextViewport);

  if (!wasInteracting) {
    editor.setViewportInteracting(false);
  }

  editor.onViewportChange?.();
  return true;
};

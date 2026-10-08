import { MAX_ZOOM, MIN_ZOOM } from "../constants";
import { clamp } from "../primitives/math";

// Every camera change goes through one of two paths:
// - `applyViewport` (programmatic moves, focus, discrete and wheel zoom)
//   moves the viewer. Its synchronous scroll echoes arrive while
//   `editor.isApplyingViewport()` is true, and the canvas adapter drops them.
// - `syncViewportFromViewer` adopts a camera the viewer reached on its own
//   (native wheel pan, hand drag) and marks it as a viewport gesture.
// Both read back the camera the viewer actually applied, so clamping or
// rounding never leaves the engine and the DOM apart, and publish it once
// through `setViewport`: live presentation listeners hear every change, and
// the store only receives it outside a viewport interaction. An interaction
// settles the store once when it ends.

export const moveViewportTo = (editor, viewport) => {
  editor.cancelPendingViewportFocus();

  return applyViewport(editor, viewport);
};

export const applyViewport = (editor, viewport) => {
  const viewer = editor.viewerRef;

  if (!viewer) {
    return false;
  }

  const current = readViewerCamera(editor, editor.viewport);
  const next = {
    x: viewport.x ?? current.x,
    y: viewport.y ?? current.y,
    zoom: clamp(viewport.zoom ?? current.zoom, MIN_ZOOM, MAX_ZOOM),
  };

  if (!isSameCamera(next, current)) {
    editor.viewportApplyDepth += 1;

    try {
      // `setTo` re-applies zoom (three viewer render passes) even when only
      // the position changes.
      if (next.zoom === current.zoom && viewer.scrollTo) {
        viewer.scrollTo(next.x, next.y);
      } else {
        viewer.setTo(next);
      }
    } finally {
      editor.viewportApplyDepth -= 1;
    }
  }

  publishCamera(editor, readViewerCamera(editor, next));
  return true;
};

export const syncViewportFromViewer = (editor) => {
  if (!editor.viewerRef || editor.isApplyingViewport()) {
    return false;
  }

  const camera = readViewerCamera(editor, editor.viewport);

  // Late echoes of an applied move (the viewer reconciles its native scroll
  // position a frame later) leave the camera where it is.
  if (isSameCamera(camera, editor.viewport)) {
    return false;
  }

  editor.setViewportGestureActive(true);
  publishCamera(editor, camera);
  return true;
};

export const attachViewport = (editor, { host, viewer }) => {
  editor.viewerRef = viewer;
  editor.hostRef = host;
  applyViewport(editor, editor.viewport);
};

export const detachViewport = (editor, viewer) => {
  if (editor.viewerRef !== viewer) {
    return;
  }

  editor.setViewportInteracting(false);
  editor.viewerRef = null;
  editor.hostRef = null;
};

const publishCamera = (editor, camera) => {
  if (editor.setViewport(camera)) {
    editor.onViewportChange?.();
  }
};

const readViewerCamera = (editor, fallback) => {
  const viewer = editor.viewerRef;

  return {
    x: viewer?.getScrollLeft?.() ?? fallback.x ?? 0,
    y: viewer?.getScrollTop?.() ?? fallback.y ?? 0,
    zoom: viewer?.getZoom?.() ?? fallback.zoom ?? 1,
  };
};

const isSameCamera = (a, b) => {
  return a.x === b.x && a.y === b.y && a.zoom === b.zoom;
};

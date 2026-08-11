import { MAX_ZOOM, MIN_ZOOM } from "../constants";
import { clamp } from "../primitives/math";
import { getSelectionBounds } from "../selection/selection-bounds";

export const zoomIn = (editor) => {
  const viewer = editor.viewerRef;
  if (!viewer) {
    return;
  }

  applyDiscreteZoom(editor, clamp(editor.zoom * 1.18, MIN_ZOOM, MAX_ZOOM));
};

export const zoomOut = (editor) => {
  const viewer = editor.viewerRef;
  if (!viewer) {
    return;
  }

  applyDiscreteZoom(editor, clamp(editor.zoom / 1.18, MIN_ZOOM, MAX_ZOOM));
};

export const zoomTo = (editor, zoom) => {
  if (!(editor.viewerRef && Number.isFinite(zoom))) {
    return false;
  }

  applyDiscreteZoom(editor, clamp(zoom, MIN_ZOOM, MAX_ZOOM));
  return true;
};

const applyDiscreteZoom = (editor, zoom) => {
  const viewer = editor.viewerRef;
  const wasInteracting = editor.viewportInteracting;

  viewer.setZoom(zoom);
  editor.setViewport({
    x: viewer.getScrollLeft?.() ?? editor.viewport.x ?? 0,
    y: viewer.getScrollTop?.() ?? editor.viewport.y ?? 0,
    zoom: viewer.getZoom?.() ?? zoom,
  });
  if (!wasInteracting) {
    editor.setViewportInteracting(false);
  }
  editor.onViewportChange?.();
};

export const cancelPendingViewportFocus = (editor) => {
  if (
    typeof window === "undefined" ||
    editor.pendingViewportFocusFrame === null
  ) {
    editor.pendingViewportFocusFrame = null;
    return;
  }

  window.cancelAnimationFrame(editor.pendingViewportFocusFrame);
  editor.pendingViewportFocusFrame = null;
};

export const scheduleViewportFocus = (editor, nodeIds, options = {}) => {
  if (typeof window === "undefined") {
    return;
  }

  cancelPendingViewportFocus(editor);
  editor.viewportFocusRequest += 1;

  const requestId = editor.viewportFocusRequest;
  const attemptFocus = (attempt = 0) => {
    if (editor.viewportFocusRequest !== requestId) {
      return;
    }

    const visibleNodeIds = nodeIds.filter((nodeId) => {
      return editor.isNodeEffectivelyVisible(nodeId);
    });

    if (visibleNodeIds.length === 0) {
      editor.pendingViewportFocusFrame = null;
      return;
    }

    const bounds = getSelectionBounds(editor, visibleNodeIds);
    const hasViewport = Boolean(editor.viewerRef && editor.hostRef);
    // During tab/canvas mount, node frames can momentarily measure as a
    // zero-size rect even though geometry reports ready; fitting that rect
    // pins the viewport to the node center at max zoom.
    const hasMeasurableBounds = Boolean(
      bounds && (bounds.maxX - bounds.minX > 1 || bounds.maxY - bounds.minY > 1)
    );
    const isReady =
      hasMeasurableBounds &&
      visibleNodeIds.every((nodeId) => {
        const node = editor.getNode(nodeId);
        if (node?.type === "artboard") {
          return Boolean(editor.getNodeGeometry(nodeId)?.ready);
        }

        return Boolean(
          (editor.getNodeTransformElement(nodeId) ||
            editor.getNodeElement(nodeId)) &&
            editor.getNodeGeometry(nodeId)?.ready
        );
      });

    if (bounds && hasViewport && (isReady || attempt >= 120)) {
      focusCanvasBoundsInViewport(editor, bounds, options);
      holdViewportFocusTarget(editor, bounds, options, requestId);
      return;
    }

    if (!hasMeasurableBounds) {
      // Degenerate bounds get cached by nodes identity; drop the cache so the
      // next attempt re-measures instead of replaying the stale rect.
      editor.selectionBoundsCache = null;
    }

    editor.pendingViewportFocusFrame = window.requestAnimationFrame(() => {
      attemptFocus(attempt + 1);
    });
  };

  editor.pendingViewportFocusFrame = window.requestAnimationFrame(() => {
    attemptFocus();
  });
};

// React commits queued before a programmatic focus can re-assert a stale
// viewer zoom/scroll through the controlled viewer props right after the
// focus applies. Hold the focus target for a few frames and re-apply until
// the viewport settles; yield immediately to user interaction.
const FOCUS_HOLD_FRAME_BUDGET = 10;
const FOCUS_HOLD_STABLE_FRAMES = 2;

const holdViewportFocusTarget = (editor, bounds, options, requestId) => {
  let target = { ...editor.viewportState };
  let stableFrames = 0;

  const attemptHold = (frame = 0) => {
    if (editor.viewportFocusRequest !== requestId) {
      return;
    }

    // Note: viewportInteracting is NOT a bail signal here — the stale viewer
    // echo itself arrives through the scroll handler and marks the viewport
    // as interacting. The hold budget is a handful of frames, so a real user
    // gesture can win at most ~160ms later.
    const viewport = editor.viewportState;
    const drifted =
      Math.abs(viewport.zoom - target.zoom) > 0.0001 ||
      Math.abs(viewport.x - target.x) > 0.5 ||
      Math.abs(viewport.y - target.y) > 0.5;

    if (drifted) {
      focusCanvasBoundsInViewport(editor, bounds, options);
      target = { ...editor.viewportState };
      stableFrames = 0;

      // setViewport suppresses store writes while the echo has the viewport
      // marked as interacting; sync the store directly so the controlled
      // viewer props converge on the focus target instead of replaying it.
      const storeViewport = editor.getState().viewport;
      if (
        storeViewport.x !== target.x ||
        storeViewport.y !== target.y ||
        storeViewport.zoom !== target.zoom
      ) {
        editor.getState().setViewport(target);
      }
    } else {
      stableFrames += 1;
    }

    if (stableFrames >= FOCUS_HOLD_STABLE_FRAMES || frame >= FOCUS_HOLD_FRAME_BUDGET) {
      editor.pendingViewportFocusFrame = null;
      return;
    }

    editor.pendingViewportFocusFrame = window.requestAnimationFrame(() => {
      attemptHold(frame + 1);
    });
  };

  editor.pendingViewportFocusFrame = window.requestAnimationFrame(() => {
    attemptHold();
  });
};

export const focusCanvasBoundsInViewport = (editor, bounds, options: { paddingX?: number; paddingY?: number; padding?: number; maxZoom?: number } = {}) => {
  const viewer = editor.viewerRef;
  const host = editor.hostRef;

  if (!(viewer && host && bounds)) {
    return;
  }

  const hostRect = host.getBoundingClientRect();
  const width = Math.max(hostRect.width, 1);
  const height = Math.max(hostRect.height, 1);
  const paddingX = options.paddingX ?? options.padding ?? 160;
  const paddingY = options.paddingY ?? options.padding ?? 160;
  const maxZoom = options.maxZoom ?? 1;
  const contentWidth = Math.max(bounds.maxX - bounds.minX, 1);
  const contentHeight = Math.max(bounds.maxY - bounds.minY, 1);
  const zoom = clamp(
    Math.min(
      width / (contentWidth + paddingX * 2),
      height / (contentHeight + paddingY * 2),
      maxZoom
    ),
    MIN_ZOOM,
    MAX_ZOOM
  );
  const canvasWidth = width / zoom;
  const canvasHeight = height / zoom;
  const x = bounds.minX - (canvasWidth - contentWidth) / 2;
  const y = bounds.minY - (canvasHeight - contentHeight) / 2;

  viewer.setTo?.({ x, y, zoom });
  editor.setViewport({ x, y, zoom });
  editor.onViewportChange?.();
};

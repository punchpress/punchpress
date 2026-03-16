import { MAX_ZOOM, MIN_ZOOM } from "../constants";
import { clamp } from "../primitives/math";
import { getSelectionBounds } from "../selection/selection-bounds";
import { isNodeVisible } from "../shapes/warp-text/model";

export const zoomIn = (editor) => {
  const viewer = editor.viewerRef;
  if (!viewer) {
    return;
  }

  viewer.setZoom(clamp(editor.zoom * 1.18, MIN_ZOOM, MAX_ZOOM));
};

export const zoomOut = (editor) => {
  const viewer = editor.viewerRef;
  if (!viewer) {
    return;
  }

  viewer.setZoom(clamp(editor.zoom / 1.18, MIN_ZOOM, MAX_ZOOM));
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

export const scheduleViewportFocus = (editor, nodeIds) => {
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
      return isNodeVisible(editor.getNode(nodeId));
    });

    if (visibleNodeIds.length === 0) {
      editor.pendingViewportFocusFrame = null;
      return;
    }

    const bounds = getSelectionBounds(editor, visibleNodeIds);
    const isReady = visibleNodeIds.every((nodeId) => {
      return Boolean(
        editor.getNodeElement(nodeId) && editor.getNodeGeometry(nodeId)?.ready
      );
    });

    if (bounds && (isReady || attempt >= 120)) {
      focusCanvasBoundsInViewport(editor, bounds);
      editor.pendingViewportFocusFrame = null;
      return;
    }

    editor.pendingViewportFocusFrame = window.requestAnimationFrame(() => {
      attemptFocus(attempt + 1);
    });
  };

  editor.pendingViewportFocusFrame = window.requestAnimationFrame(() => {
    attemptFocus();
  });
};

const focusCanvasBoundsInViewport = (editor, bounds) => {
  const viewer = editor.viewerRef;
  const host = editor.hostRef;

  if (!(viewer && host && bounds)) {
    return;
  }

  const hostRect = host.getBoundingClientRect();
  const width = Math.max(hostRect.width, 1);
  const height = Math.max(hostRect.height, 1);
  const padding = 160;
  const contentWidth = Math.max(bounds.maxX - bounds.minX, 1);
  const contentHeight = Math.max(bounds.maxY - bounds.minY, 1);
  const zoom = clamp(
    Math.min(
      width / (contentWidth + padding * 2),
      height / (contentHeight + padding * 2),
      1
    ),
    MIN_ZOOM,
    MAX_ZOOM
  );
  const canvasWidth = width / zoom;
  const canvasHeight = height / zoom;
  const x = bounds.minX - (canvasWidth - contentWidth) / 2;
  const y = bounds.minY - (canvasHeight - contentHeight) / 2;

  viewer.setTo?.({ x, y, zoom });
  editor.setViewportZoom(zoom);
};

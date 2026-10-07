import { MAX_ZOOM, MIN_ZOOM } from "../constants";
import {
  isArtboardNode,
  isContentContainerNode,
  isVectorNode,
} from "../nodes/node-tree";
import { clamp } from "../primitives/math";
import { getSelectionBounds } from "../selection/selection-bounds";
import { applyViewport } from "./viewport-move";

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
  // Invalidate the request too, so an already-dispatched frame cannot apply it.
  editor.viewportFocusRequest += 1;

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
      visibleNodeIds.every((nodeId) => isNodeReadyForFocus(editor, nodeId));

    if (bounds && hasViewport && (isReady || attempt >= 120)) {
      editor.pendingViewportFocusFrame = null;
      focusCanvasBoundsInViewport(editor, bounds, options);
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

const isNodeReadyForFocus = (editor, nodeId) => {
  const node = editor.getNode(nodeId);

  if (isArtboardNode(node)) {
    return Boolean(editor.getNodeGeometry(nodeId)?.ready);
  }

  // Groups and vectors have no geometry of their own; their leaves gate focus.
  if (isContentContainerNode(node)) {
    return true;
  }

  return Boolean(
    editor.getNodeGeometry(nodeId)?.ready && hasRenderedElement(editor, node)
  );
};

// Vector child paths render through their container's element, so readiness
// accepts the nearest rendered ancestor.
const hasRenderedElement = (editor, node) => {
  let currentNode = node;

  while (currentNode) {
    if (
      editor.getNodeTransformElement(currentNode.id) ||
      editor.getNodeElement(currentNode.id)
    ) {
      return true;
    }

    currentNode = isVectorNode(editor.getNode(currentNode.parentId))
      ? editor.getNode(currentNode.parentId)
      : null;
  }

  return false;
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

  applyViewport(editor, { x, y, zoom });
};

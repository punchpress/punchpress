import { getNodeCssTransform } from "@punchpress/engine";
import { getHostRectFromCanvasBounds } from "./canvas-overlay-geometry";

const getBoundsCenter = (bounds) => {
  if (!bounds) {
    return null;
  }

  return {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
  };
};

export const getTextPathHostMetrics = (editor) => {
  const host = editor.hostRef;
  const viewer = editor.viewerRef;

  if (!(host && viewer && editor.zoom > 0)) {
    return null;
  }

  const scrollLeft = viewer.getScrollLeft?.();
  const scrollTop = viewer.getScrollTop?.();

  if (!(Number.isFinite(scrollLeft) && Number.isFinite(scrollTop))) {
    return null;
  }

  return {
    height: host.clientHeight,
    scrollLeft,
    scrollTop,
    width: host.clientWidth,
  };
};

export const getTextPathOverlayBounds = (geometry) => {
  return geometry?.selectionBounds || geometry?.bbox || null;
};

export const getTextPathRenderCenter = (geometry) => {
  return getBoundsCenter(geometry?.bbox);
};

export const getTextPathGuideMatrix = (node, geometry, metrics, zoom) => {
  const renderCenter = getTextPathRenderCenter(geometry);

  if (!(node && renderCenter && metrics && zoom > 0)) {
    return null;
  }

  const worldCenter = {
    x: node.transform.x + renderCenter.x,
    y: node.transform.y + renderCenter.y,
  };
  const rotation = ((node.transform.rotation || 0) * Math.PI) / 180;
  const scaleX = node.transform.scaleX ?? 1;
  const scaleY = node.transform.scaleY ?? 1;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const a = cos * scaleX * zoom;
  const b = sin * scaleX * zoom;
  const c = -sin * scaleY * zoom;
  const d = cos * scaleY * zoom;

  return {
    a,
    b,
    c,
    d,
    e:
      (worldCenter.x - metrics.scrollLeft) * zoom -
      (a * renderCenter.x + c * renderCenter.y),
    f:
      (worldCenter.y - metrics.scrollTop) * zoom -
      (b * renderCenter.x + d * renderCenter.y),
  };
};

export const projectTextPathPoint = (matrix, point) => {
  if (!(matrix && point)) {
    return null;
  }

  return {
    x: matrix.a * point.x + matrix.c * point.y + matrix.e,
    y: matrix.b * point.x + matrix.d * point.y + matrix.f,
  };
};

export const getTextPathTransformTargetStyle = (editor, node, geometry) => {
  const overlayBounds = getTextPathOverlayBounds(geometry);
  const renderCenter = getTextPathRenderCenter(geometry);

  if (!(overlayBounds && renderCenter)) {
    return null;
  }

  const hostRect = getHostRectFromCanvasBounds(editor, {
    height: overlayBounds.height,
    maxX: node.transform.x + overlayBounds.maxX,
    maxY: node.transform.y + overlayBounds.maxY,
    minX: node.transform.x + overlayBounds.minX,
    minY: node.transform.y + overlayBounds.minY,
    width: overlayBounds.width,
  });

  if (!hostRect) {
    return null;
  }

  return {
    height: `${hostRect.height}px`,
    left: `${hostRect.left}px`,
    top: `${hostRect.top}px`,
    transform: getNodeCssTransform(node),
    transformOrigin: `${(renderCenter.x - overlayBounds.minX) * editor.zoom}px ${
      (renderCenter.y - overlayBounds.minY) * editor.zoom
    }px`,
    width: `${hostRect.width}px`,
  };
};

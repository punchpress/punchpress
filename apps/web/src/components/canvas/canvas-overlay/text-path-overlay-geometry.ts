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

export const getTextPathOverlayBounds = (geometry, useGuideBounds = false) => {
  if (useGuideBounds && geometry?.guide?.bounds) {
    return geometry.guide.bounds;
  }

  return geometry?.selectionBounds || geometry?.bbox || null;
};

export const getTextPathRenderCenter = (geometry) => {
  return getBoundsCenter(geometry?.bbox);
};

export const getTextPathGuideMatrix = (
  node,
  geometry,
  metrics,
  zoom,
  previewDelta = null
) => {
  const renderCenter = getTextPathRenderCenter(geometry);

  if (!(node && renderCenter && metrics && zoom > 0)) {
    return null;
  }

  const worldCenter = {
    x: node.transform.x + (previewDelta?.x || 0) + renderCenter.x,
    y: node.transform.y + (previewDelta?.y || 0) + renderCenter.y,
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

export const getTextPathTransformTargetStyle = (
  editor,
  node,
  geometry,
  previewDelta = null,
  useGuideBounds = false
) => {
  if (useGuideBounds && geometry?.guide?.bounds) {
    const metrics = getTextPathHostMetrics(editor);
    const renderCenter = getTextPathRenderCenter(geometry);
    const guideBounds = geometry.guide.bounds;

    if (!(metrics && renderCenter)) {
      return null;
    }

    const guideCenter = getBoundsCenter(guideBounds);

    if (!guideCenter) {
      return null;
    }

    const rotation = ((node.transform.rotation || 0) * Math.PI) / 180;
    const scaleX = node.transform.scaleX ?? 1;
    const scaleY = node.transform.scaleY ?? 1;
    const offset = {
      x: (guideCenter.x - renderCenter.x) * scaleX,
      y: (guideCenter.y - renderCenter.y) * scaleY,
    };
    const worldGuideCenter = {
      x:
        node.transform.x +
        (previewDelta?.x || 0) +
        renderCenter.x +
        (offset.x * Math.cos(rotation) - offset.y * Math.sin(rotation)),
      y:
        node.transform.y +
        (previewDelta?.y || 0) +
        renderCenter.y +
        (offset.x * Math.sin(rotation) + offset.y * Math.cos(rotation)),
    };
    const width = guideBounds.width * Math.abs(scaleX) * editor.zoom;
    const height = guideBounds.height * Math.abs(scaleY) * editor.zoom;

    return {
      height: `${height}px`,
      left: `${(worldGuideCenter.x - metrics.scrollLeft) * editor.zoom - width / 2}px`,
      top: `${(worldGuideCenter.y - metrics.scrollTop) * editor.zoom - height / 2}px`,
      width: `${width}px`,
    };
  }

  const overlayBounds = getTextPathOverlayBounds(geometry, useGuideBounds);
  const renderCenter = getTextPathRenderCenter(geometry);

  if (!(overlayBounds && renderCenter)) {
    return null;
  }

  const hostRect = getHostRectFromCanvasBounds(editor, {
    height: overlayBounds.height,
    maxX: node.transform.x + (previewDelta?.x || 0) + overlayBounds.maxX,
    maxY: node.transform.y + (previewDelta?.y || 0) + overlayBounds.maxY,
    minX: node.transform.x + (previewDelta?.x || 0) + overlayBounds.minX,
    minY: node.transform.y + (previewDelta?.y || 0) + overlayBounds.minY,
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

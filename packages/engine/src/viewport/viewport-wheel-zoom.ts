import { MAX_ZOOM, MIN_ZOOM } from "../constants";
import { clamp } from "../primitives/math";

const MAX_WHEEL_ZOOM_STEP = 10;
const WHEEL_ZOOM_DIVISOR = 100;

const getViewportClientRect = (editor) => {
  const viewer = editor.viewerRef;
  const container = viewer?.getContainer?.();

  if (container?.getBoundingClientRect) {
    return container.getBoundingClientRect();
  }

  return editor.hostRef?.getBoundingClientRect?.() || null;
};

const getLinearWheelZoomDelta = (deltaY) => {
  const sign = Math.sign(deltaY);
  const distance = Math.min(MAX_WHEEL_ZOOM_STEP, Math.abs(deltaY));

  return (-sign * distance) / WHEEL_ZOOM_DIVISOR;
};

const getWheelZoomViewport = ({
  clientX,
  clientY,
  currentZoom,
  deltaY,
  rect,
  scrollLeft,
  scrollTop,
}) => {
  if (!(rect && currentZoom > 0)) {
    return null;
  }

  const width = Math.max(rect.width, 1);
  const height = Math.max(rect.height, 1);
  const localX = clamp(clientX - rect.left, 0, width);
  const localY = clamp(clientY - rect.top, 0, height);
  const zoomDelta = getLinearWheelZoomDelta(deltaY);
  const nextZoom = clamp(
    currentZoom + zoomDelta * currentZoom,
    MIN_ZOOM,
    MAX_ZOOM
  );

  if (nextZoom === currentZoom) {
    return null;
  }

  const anchorX = scrollLeft + localX / currentZoom;
  const anchorY = scrollTop + localY / currentZoom;

  return {
    x: anchorX - localX / nextZoom,
    y: anchorY - localY / nextZoom,
    zoom: nextZoom,
  };
};

export const zoomViewportFromWheel = (editor, { clientX, clientY, deltaY }) => {
  const viewer = editor.viewerRef;
  if (!viewer) {
    return false;
  }

  const nextViewport = getWheelZoomViewport({
    clientX,
    clientY,
    currentZoom: editor.zoom,
    deltaY,
    rect: getViewportClientRect(editor),
    scrollLeft: viewer.getScrollLeft(),
    scrollTop: viewer.getScrollTop(),
  });

  if (!nextViewport) {
    return false;
  }

  if (viewer.setTo) {
    viewer.setTo(nextViewport);
  } else {
    viewer.scrollTo?.(nextViewport.x, nextViewport.y);
    viewer.setZoom?.(nextViewport.zoom);
  }

  editor.setViewportZoom(nextViewport.zoom);
  editor.onViewportChange?.();

  return true;
};

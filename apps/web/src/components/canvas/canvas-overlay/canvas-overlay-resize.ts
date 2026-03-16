import { getResizeCorner } from "../../../editor/primitives/group-resize";
import { clamp } from "../../../editor/primitives/math";

const getRectCenter = (rect) => {
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
};

const getResizeHandleSelector = (corner) => {
  return `.canvas-moveable .moveable-control.moveable-${corner}`;
};

const getHandleClientCenter = (hostElement, selector) => {
  const element = hostElement?.querySelector(selector);
  const rect = element?.getBoundingClientRect?.();
  if (!rect) {
    return null;
  }

  return getRectCenter(rect);
};

const getCanvasPointFromClientPoint = (editor, point) => {
  const host = editor.hostRef;
  const viewer = editor.viewerRef;
  if (!(host && viewer && point && editor.zoom > 0)) {
    return null;
  }

  const hostRect = host.getBoundingClientRect();

  return {
    x: viewer.getScrollLeft() + (point.x - hostRect.left) / editor.zoom,
    y: viewer.getScrollTop() + (point.y - hostRect.top) / editor.zoom,
  };
};

export const getResizePointer = (event) => {
  const inputEvent = event.inputEvent;
  if (
    inputEvent &&
    "clientX" in inputEvent &&
    "clientY" in inputEvent &&
    typeof inputEvent.clientX === "number" &&
    typeof inputEvent.clientY === "number"
  ) {
    return {
      x: inputEvent.clientX,
      y: inputEvent.clientY,
    };
  }

  if (typeof event.clientX === "number" && typeof event.clientY === "number") {
    return {
      x: event.clientX,
      y: event.clientY,
    };
  }

  return null;
};

export const getResizeSession = (editor, hostElement, direction, pointer) => {
  if (!pointer) {
    return null;
  }

  const anchorClient = getHandleClientCenter(
    hostElement,
    getResizeHandleSelector(getResizeCorner(direction, true))
  );
  if (!anchorClient) {
    return null;
  }

  const anchorCanvas = getCanvasPointFromClientPoint(editor, anchorClient);
  if (!anchorCanvas) {
    return null;
  }

  return {
    anchorCanvas,
    anchorClient,
    startDistance: Math.max(
      Math.hypot(pointer.x - anchorClient.x, pointer.y - anchorClient.y),
      1
    ),
  };
};

export const getResizeScale = (event, anchorClient, startDistance) => {
  if (!(anchorClient && Number.isFinite(startDistance))) {
    return null;
  }

  const pointer = getResizePointer(event);
  if (!pointer) {
    return null;
  }

  return clamp(
    Math.hypot(pointer.x - anchorClient.x, pointer.y - anchorClient.y) /
      startDistance,
    0.001,
    20
  );
};

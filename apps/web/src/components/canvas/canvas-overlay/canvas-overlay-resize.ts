import {
  getResizeCorner,
  getResizedNodeUpdate,
  getScaledGroupNodeUpdate,
} from "../../../editor/primitives/group-resize";
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

export const updateSingleNodeResize = (editor, selectedNode, event) => {
  if (
    !(
      selectedNode &&
      event.datas.baseBBox &&
      event.datas.anchorClient &&
      event.datas.anchorCanvas &&
      event.datas.direction &&
      Number.isFinite(event.datas.startDistance)
    )
  ) {
    return;
  }

  const pointer = getResizePointer(event);
  if (!pointer) {
    return;
  }

  const resizeScale = clamp(
    Math.hypot(
      pointer.x - event.datas.anchorClient.x,
      pointer.y - event.datas.anchorClient.y
    ) / event.datas.startDistance,
    0.001,
    20
  );

  editor.updateNode(
    selectedNode.id,
    getResizedNodeUpdate(
      event.datas.baseNode,
      event.datas.baseBBox,
      event.datas.anchorCanvas,
      resizeScale,
      event.datas.direction
    )
  );
};

export const updateGroupResize = (editor, visibleSelectedNodeIds, event) => {
  const anchorCanvas = event.datas.anchorCanvas;
  const baseNodes = event.datas.baseNodes;
  const anchorClient = event.datas.anchorClient;

  if (
    !(
      anchorCanvas &&
      anchorClient &&
      baseNodes &&
      Number.isFinite(event.datas.startDistance)
    )
  ) {
    return;
  }

  const pointer = getResizePointer(event);
  if (!pointer) {
    return;
  }

  const scale = clamp(
    Math.hypot(pointer.x - anchorClient.x, pointer.y - anchorClient.y) /
      event.datas.startDistance,
    0.001,
    20
  );

  editor.updateNodes(visibleSelectedNodeIds, (node) => {
    const baseNode = baseNodes.get(node.id);

    if (!baseNode) {
      return node;
    }

    return getScaledGroupNodeUpdate(baseNode, anchorCanvas, scale);
  });
};

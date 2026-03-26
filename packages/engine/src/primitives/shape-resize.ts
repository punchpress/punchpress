import { round } from "./math";
import {
  getNodeLocalPoint,
  getNodeTransformForPinnedWorldPoint,
} from "./rotation";

const isCornerHandle = (handle) => {
  return handle.length === 2;
};

const getStrokeInset = (node) => {
  return Math.max(node.strokeWidth / 2, 0);
};

const getMinimumOuterSize = (node) => {
  return 1 + getStrokeInset(node) * 2;
};

const getClampedFreeformBounds = (bounds, pointerLocal, handle, node) => {
  const minOuterWidth = getMinimumOuterSize(node);
  const minOuterHeight = getMinimumOuterSize(node);
  let minX = bounds.minX;
  let maxX = bounds.maxX;
  let minY = bounds.minY;
  let maxY = bounds.maxY;

  if (handle.endsWith("w")) {
    minX = Math.min(pointerLocal.x, maxX - minOuterWidth);
  } else if (handle.endsWith("e")) {
    maxX = Math.max(pointerLocal.x, minX + minOuterWidth);
  }

  if (handle.startsWith("n")) {
    minY = Math.min(pointerLocal.y, maxY - minOuterHeight);
  } else if (handle.startsWith("s")) {
    maxY = Math.max(pointerLocal.y, minY + minOuterHeight);
  }

  return {
    maxX,
    maxY,
    minX,
    minY,
  };
};

const getAspectLockedBounds = (baseBounds, rawBounds, handle, node) => {
  const baseWidth = baseBounds.maxX - baseBounds.minX;
  const baseHeight = baseBounds.maxY - baseBounds.minY;
  const rawWidth = rawBounds.maxX - rawBounds.minX;
  const rawHeight = rawBounds.maxY - rawBounds.minY;
  const minOuterWidth = getMinimumOuterSize(node);
  const minOuterHeight = getMinimumOuterSize(node);
  const scale = Math.max(
    rawWidth / baseWidth,
    rawHeight / baseHeight,
    minOuterWidth / baseWidth,
    minOuterHeight / baseHeight
  );
  const nextWidth = baseWidth * scale;
  const nextHeight = baseHeight * scale;

  return {
    maxX: handle.endsWith("w") ? baseBounds.maxX : baseBounds.minX + nextWidth,
    maxY: handle.startsWith("n")
      ? baseBounds.maxY
      : baseBounds.minY + nextHeight,
    minX: handle.endsWith("w") ? baseBounds.maxX - nextWidth : baseBounds.minX,
    minY: handle.startsWith("n")
      ? baseBounds.maxY - nextHeight
      : baseBounds.minY,
  };
};

const getBoundsForHandle = (bounds, handle) => {
  switch (handle) {
    case "e":
      return { x: bounds.minX, y: 0 };
    case "n":
      return { x: 0, y: bounds.maxY };
    case "ne":
      return { x: bounds.minX, y: bounds.maxY };
    case "nw":
      return { x: bounds.maxX, y: bounds.maxY };
    case "s":
      return { x: 0, y: bounds.minY };
    case "se":
      return { x: bounds.minX, y: bounds.minY };
    case "sw":
      return { x: bounds.maxX, y: bounds.minY };
    case "w":
      return { x: bounds.maxX, y: 0 };
    default:
      return { x: bounds.minX, y: bounds.minY };
  }
};

const getShapeBounds = (nodeWidth, nodeHeight, strokeInset) => {
  return {
    height: nodeHeight + strokeInset * 2,
    maxX: nodeWidth / 2 + strokeInset,
    maxY: nodeHeight / 2 + strokeInset,
    minX: -(nodeWidth / 2) - strokeInset,
    minY: -(nodeHeight / 2) - strokeInset,
    width: nodeWidth + strokeInset * 2,
  };
};

export const getResizedShapeNodeUpdate = (
  node,
  bounds,
  anchorCanvas,
  pointCanvas,
  handle,
  { preserveAspectRatio = false } = {}
) => {
  if (!(anchorCanvas && pointCanvas && handle)) {
    return null;
  }

  const pointerLocal = getNodeLocalPoint(node, bounds, pointCanvas);
  const rawBounds = getClampedFreeformBounds(
    bounds,
    pointerLocal,
    handle,
    node
  );
  const nextBounds =
    preserveAspectRatio && isCornerHandle(handle)
      ? getAspectLockedBounds(bounds, rawBounds, handle, node)
      : rawBounds;
  const strokeInset = getStrokeInset(node);
  const width = round(
    Math.max(1, nextBounds.maxX - nextBounds.minX - strokeInset * 2),
    2
  );
  const height = round(
    Math.max(1, nextBounds.maxY - nextBounds.minY - strokeInset * 2),
    2
  );
  const nextShapeBounds = getShapeBounds(width, height, strokeInset);

  return {
    height,
    transform: getNodeTransformForPinnedWorldPoint(
      node,
      nextShapeBounds,
      getBoundsForHandle(nextShapeBounds, handle),
      anchorCanvas
    ),
    width,
  };
};

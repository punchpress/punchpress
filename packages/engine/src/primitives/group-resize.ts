import {
  getNodeRotation,
  getNodeScaleX,
  getNodeScaleY,
  getNodeX,
  getNodeY,
} from "../nodes/text/model";
import { round } from "./math";
import { getLocalBoundsCenter, rotateVector } from "./rotation";

const getScaledWarp = (warp, scale) => {
  if (!warp) {
    return null;
  }

  if (warp.kind === "circle") {
    return {
      ...warp,
      radius: round(Math.max(1, warp.radius * scale), 2),
    };
  }

  if (warp.kind === "wave") {
    return {
      ...warp,
      amplitude: round(warp.amplitude * scale, 2),
    };
  }

  return warp;
};

export const getResizeCorner = (direction, opposite = false) => {
  const [horizontalDirection, verticalDirection] = opposite
    ? [-direction[0], -direction[1]]
    : direction;

  return `${verticalDirection > 0 ? "s" : "n"}${
    horizontalDirection > 0 ? "e" : "w"
  }`;
};

export const getCornerPointFromBounds = (bounds, corner) => {
  return {
    x: corner.endsWith("e") ? bounds.maxX : bounds.minX,
    y: corner.startsWith("s") ? bounds.maxY : bounds.minY,
  };
};

export const getResizeAnchorFromBounds = (bounds, direction) => {
  return getCornerPointFromBounds(bounds, getResizeCorner(direction, true));
};

export const getScaledGroupNodeUpdate = (node, anchor, scale) => {
  return {
    fontSize: round(Math.max(1, node.fontSize * scale), 2),
    strokeWidth: round(Math.max(0, node.strokeWidth * scale), 2),
    tracking: round(node.tracking * scale, 2),
    transform: {
      x: round(anchor.x + (getNodeX(node) - anchor.x) * scale, 2),
      y: round(anchor.y + (getNodeY(node) - anchor.y) * scale, 2),
    },
    warp: getScaledWarp(node.warp, scale),
  };
};

export const getResizedNodeUpdate = (node, bbox, anchor, scale, direction) => {
  const fixedCorner = getCornerPointFromBounds(
    bbox,
    getResizeCorner(direction, true)
  );
  const localCenter = getLocalBoundsCenter(bbox);
  const scaleX = getNodeScaleX(node) ?? 1;
  const scaleY = getNodeScaleY(node) ?? 1;
  const scaledCenter = {
    x: localCenter.x * scale,
    y: localCenter.y * scale,
  };
  const scaledFixedCorner = {
    x: fixedCorner.x * scale,
    y: fixedCorner.y * scale,
  };
  const rotatedOffset = rotateVector(
    {
      x: (scaledFixedCorner.x - scaledCenter.x) * scaleX,
      y: (scaledFixedCorner.y - scaledCenter.y) * scaleY,
    },
    getNodeRotation(node) || 0
  );

  return {
    fontSize: round(Math.max(1, node.fontSize * scale), 2),
    strokeWidth: round(Math.max(0, node.strokeWidth * scale), 2),
    tracking: round(node.tracking * scale, 2),
    transform: {
      x: round(anchor.x - scaledCenter.x - rotatedOffset.x, 2),
      y: round(anchor.y - scaledCenter.y - rotatedOffset.y, 2),
    },
    warp: getScaledWarp(node.warp, scale),
  };
};

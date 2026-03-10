import { round } from "./math";
import { getLocalBoundsCenter, rotateVector } from "./rotation";

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
    x: round(anchor.x + (node.x - anchor.x) * scale, 2),
    y: round(anchor.y + (node.y - anchor.y) * scale, 2),
  };
};

export const getResizedNodeUpdate = (node, bbox, anchor, scale, direction) => {
  const fixedCorner = getCornerPointFromBounds(
    bbox,
    getResizeCorner(direction, true)
  );
  const localCenter = getLocalBoundsCenter(bbox);
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
      x: scaledFixedCorner.x - scaledCenter.x,
      y: scaledFixedCorner.y - scaledCenter.y,
    },
    node.rotation || 0
  );

  return {
    fontSize: round(Math.max(1, node.fontSize * scale), 2),
    strokeWidth: round(Math.max(0, node.strokeWidth * scale), 2),
    tracking: round(node.tracking * scale, 2),
    x: round(anchor.x - scaledCenter.x - rotatedOffset.x, 2),
    y: round(anchor.y - scaledCenter.y - rotatedOffset.y, 2),
  };
};

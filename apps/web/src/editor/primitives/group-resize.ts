import { round } from "./math";

export const getResizeAnchorFromBounds = (bounds, direction) => {
  const [horizontalDirection, verticalDirection] = direction;

  return {
    x: horizontalDirection >= 0 ? bounds.minX : bounds.maxX,
    y: verticalDirection >= 0 ? bounds.minY : bounds.maxY,
  };
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

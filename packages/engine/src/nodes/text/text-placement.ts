import { buildNodeGeometry } from "./warp-engine";
import { estimateBounds } from "./warp-layout";

const getPlacementBounds = (node, font) => {
  if (!font) {
    return estimateBounds(node);
  }

  return buildNodeGeometry(node, font).bbox || estimateBounds(node);
};

export const getTextNodePlacementOrigin = (node, point, font) => {
  if (!point) {
    return {
      x: node.transform.x,
      y: node.transform.y,
    };
  }

  const bounds = getPlacementBounds(node, font);
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;

  return {
    x: point.x - centerX,
    y: point.y - centerY,
  };
};

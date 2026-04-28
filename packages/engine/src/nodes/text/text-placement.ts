import { buildNodeGeometry } from "./warp-engine";
import { estimateBounds } from "./warp-layout";

const ESTIMATED_ASCENDER_RATIO = 0.9;
const ESTIMATED_DESCENDER_RATIO = 0.1;

const getEstimatedPlacementBounds = (node) => {
  const bounds = estimateBounds(node);
  const ascender = Math.max(20, node.fontSize * ESTIMATED_ASCENDER_RATIO);
  const descender = Math.max(0, node.fontSize * ESTIMATED_DESCENDER_RATIO);

  return {
    ...bounds,
    height: ascender + descender,
    maxY: descender,
    minY: -ascender,
  };
};

const getPlacementBounds = (node, font) => {
  if (!font) {
    return getEstimatedPlacementBounds(node);
  }

  return buildNodeGeometry(node, font).bbox || getEstimatedPlacementBounds(node);
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

import { getNodeWorldBounds } from "../primitives/rotation";
import { getNodeCssTransform, getNodeX, getNodeY } from "./text/model";

export const toWorldFrame = (node, bounds) => {
  if (!bounds) {
    return null;
  }

  return {
    bounds: {
      height: bounds.height,
      maxX: getNodeX(node) + bounds.maxX,
      maxY: getNodeY(node) + bounds.maxY,
      minX: getNodeX(node) + bounds.minX,
      minY: getNodeY(node) + bounds.minY,
      width: bounds.width,
    },
    transform: getNodeCssTransform(node),
  };
};

export const toTransformedWorldFrame = (node, bounds) => {
  if (!bounds) {
    return null;
  }

  return {
    bounds: getNodeWorldBounds(node, bounds),
    transform: getNodeCssTransform(node),
  };
};

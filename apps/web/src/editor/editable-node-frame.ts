import {
  getNodeCssTransform,
  getNodeX,
  getNodeY,
} from "./shapes/warp-text/model";
import { estimateBounds } from "./shapes/warp-text/warp-engine";

const getTextNodeEditableBounds = (node, geometry) => {
  return geometry?.bbox || estimateBounds(node);
};

export const getEditableNodeBounds = (node, geometry) => {
  if (!node) {
    return null;
  }

  switch (node.type) {
    case "text":
      return getTextNodeEditableBounds(node, geometry);
    default:
      return null;
  }
};

export const getEditableNodeFrame = (node, geometry) => {
  const bounds = getEditableNodeBounds(node, geometry);
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

import {
  getNodeCssTransform,
  getNodeX,
  getNodeY,
} from "./shapes/warp-text/model";
import { estimateBounds } from "./shapes/warp-text/warp-layout";

const getTextNodeEditableBounds = (
  node,
  geometry,
  useSelectionBounds = false
) => {
  if (useSelectionBounds) {
    return geometry?.selectionBounds || geometry?.bbox || estimateBounds(node);
  }

  return geometry?.bbox || estimateBounds(node);
};

const getTextNodeRenderBounds = (node, geometry) => {
  return geometry?.bbox || estimateBounds(node);
};

export const getEditableNodeBounds = (
  node,
  geometry,
  { useSelectionBounds = false } = {}
) => {
  if (!node) {
    return null;
  }

  switch (node.type) {
    case "text":
      return getTextNodeEditableBounds(node, geometry, useSelectionBounds);
    default:
      return null;
  }
};

export const getRenderNodeBounds = (node, geometry) => {
  if (!node) {
    return null;
  }

  switch (node.type) {
    case "text":
      return getTextNodeRenderBounds(node, geometry);
    default:
      return null;
  }
};

export const getEditableNodeFrame = (
  node,
  geometry,
  { useSelectionBounds = false } = {}
) => {
  const bounds = getEditableNodeBounds(node, geometry, { useSelectionBounds });
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

export const getRenderNodeFrame = (node, geometry) => {
  const bounds = getRenderNodeBounds(node, geometry);
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

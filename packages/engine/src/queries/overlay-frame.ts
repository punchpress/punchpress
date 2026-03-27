import {
  getNodeRotation,
  getNodeScaleX,
  getNodeScaleY,
  getNodeX,
  getNodeY,
} from "../nodes/text/model";
import { getLocalBoundsCenter } from "../primitives/rotation";

export const getOverlayLocalBounds = (node, bounds) => {
  if (!bounds) {
    return null;
  }

  const scaleX = getNodeScaleX(node) ?? 1;
  const scaleY = getNodeScaleY(node) ?? 1;

  if (Math.abs(scaleX - 1) <= 0.0001 && Math.abs(scaleY - 1) <= 0.0001) {
    return bounds;
  }

  const localCenter = getLocalBoundsCenter(bounds);
  const scaledX1 = localCenter.x + (bounds.minX - localCenter.x) * scaleX;
  const scaledX2 = localCenter.x + (bounds.maxX - localCenter.x) * scaleX;
  const scaledY1 = localCenter.y + (bounds.minY - localCenter.y) * scaleY;
  const scaledY2 = localCenter.y + (bounds.maxY - localCenter.y) * scaleY;
  const minX = Math.min(scaledX1, scaledX2);
  const maxX = Math.max(scaledX1, scaledX2);
  const minY = Math.min(scaledY1, scaledY2);
  const maxY = Math.max(scaledY1, scaledY2);

  return {
    height: maxY - minY,
    maxX,
    maxY,
    minX,
    minY,
    width: maxX - minX,
  };
};

export const getOverlayTransform = (node) => {
  const rotation = getNodeRotation(node) || 0;

  return rotation ? `rotate(${rotation}deg)` : undefined;
};

export const getOverlayWorldFrame = (node, bounds) => {
  const overlayBounds = getOverlayLocalBounds(node, bounds);

  if (!overlayBounds) {
    return null;
  }

  return {
    bounds: {
      height: overlayBounds.height,
      maxX: getNodeX(node) + overlayBounds.maxX,
      maxY: getNodeY(node) + overlayBounds.maxY,
      minX: getNodeX(node) + overlayBounds.minX,
      minY: getNodeY(node) + overlayBounds.minY,
      width: overlayBounds.width,
    },
    transform: getOverlayTransform(node),
  };
};

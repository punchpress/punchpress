import {
  getNodeRotation,
  getNodeScaleX,
  getNodeScaleY,
  getNodeX,
  getNodeY,
} from "../shapes/warp-text/model";
import { round } from "./math";

export const getLocalBoundsCenter = (bbox) => {
  return {
    x: (bbox.minX + bbox.maxX) / 2,
    y: (bbox.minY + bbox.maxY) / 2,
  };
};

export const getNodeRotationCenter = (node, bbox) => {
  const localCenter = getLocalBoundsCenter(bbox);

  return {
    x: getNodeX(node) + localCenter.x,
    y: getNodeY(node) + localCenter.y,
  };
};

export const rotatePointAround = (point, center, rotation) => {
  if (rotation === 0) {
    return point;
  }

  const angle = (rotation * Math.PI) / 180;
  const offsetX = point.x - center.x;
  const offsetY = point.y - center.y;

  return {
    x: center.x + offsetX * Math.cos(angle) - offsetY * Math.sin(angle),
    y: center.y + offsetX * Math.sin(angle) + offsetY * Math.cos(angle),
  };
};

export const rotateVector = (vector, rotation) => {
  return rotatePointAround(vector, { x: 0, y: 0 }, rotation);
};

export const getNodeWorldPoint = (node, bbox, point) => {
  const localCenter = getLocalBoundsCenter(bbox);
  const worldCenter = getNodeRotationCenter(node, bbox);
  const scaleX = getNodeScaleX(node) ?? 1;
  const scaleY = getNodeScaleY(node) ?? 1;
  const rotatedOffset = rotateVector(
    {
      x: (point.x - localCenter.x) * scaleX,
      y: (point.y - localCenter.y) * scaleY,
    },
    getNodeRotation(node) || 0
  );

  return {
    x: worldCenter.x + rotatedOffset.x,
    y: worldCenter.y + rotatedOffset.y,
  };
};

export const getNodeLocalPoint = (node, bbox, point) => {
  const localCenter = getLocalBoundsCenter(bbox);
  const worldCenter = getNodeRotationCenter(node, bbox);
  const scaleX = getNodeScaleX(node) ?? 1;
  const scaleY = getNodeScaleY(node) ?? 1;
  const rotation = ((getNodeRotation(node) || 0) * Math.PI) / 180;
  const offsetX = point.x - worldCenter.x;
  const offsetY = point.y - worldCenter.y;
  const unrotatedX =
    offsetX * Math.cos(-rotation) - offsetY * Math.sin(-rotation);
  const unrotatedY =
    offsetX * Math.sin(-rotation) + offsetY * Math.cos(-rotation);

  return {
    x: localCenter.x + unrotatedX / (scaleX || 1),
    y: localCenter.y + unrotatedY / (scaleY || 1),
  };
};

export const getRotatedNodeUpdate = (
  baseNode,
  bbox,
  selectionCenter,
  deltaRotation
) => {
  const localCenter = getLocalBoundsCenter(bbox);
  const nextCenter = rotatePointAround(
    getNodeRotationCenter(baseNode, bbox),
    selectionCenter,
    deltaRotation
  );

  return {
    transform: {
      rotation: round((getNodeRotation(baseNode) || 0) + deltaRotation, 2),
      x: round(nextCenter.x - localCenter.x, 2),
      y: round(nextCenter.y - localCenter.y, 2),
    },
  };
};

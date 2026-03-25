import {
  getNodeRotation,
  getNodeScaleX,
  getNodeScaleY,
  getNodeX,
  getNodeY,
} from "../nodes/text/model";
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

export const getNodeTransformFrame = (node, bbox) => {
  const localCenter = getLocalBoundsCenter(bbox);

  return {
    localCenter,
    rotation: getNodeRotation(node) || 0,
    scaleX: getNodeScaleX(node) ?? 1,
    scaleY: getNodeScaleY(node) ?? 1,
    worldCenter: getNodeRotationCenter(node, bbox),
  };
};

export const getWorldPointFromTransformFrame = (frame, point) => {
  const rotatedOffset = rotateVector(
    {
      x: (point.x - frame.localCenter.x) * frame.scaleX,
      y: (point.y - frame.localCenter.y) * frame.scaleY,
    },
    frame.rotation
  );

  return {
    x: frame.worldCenter.x + rotatedOffset.x,
    y: frame.worldCenter.y + rotatedOffset.y,
  };
};

export const getLocalPointFromTransformFrame = (frame, point) => {
  const rotation = (frame.rotation * Math.PI) / 180;
  const offsetX = point.x - frame.worldCenter.x;
  const offsetY = point.y - frame.worldCenter.y;
  const unrotatedX =
    offsetX * Math.cos(-rotation) - offsetY * Math.sin(-rotation);
  const unrotatedY =
    offsetX * Math.sin(-rotation) + offsetY * Math.cos(-rotation);

  return {
    x: frame.localCenter.x + unrotatedX / (frame.scaleX || 1),
    y: frame.localCenter.y + unrotatedY / (frame.scaleY || 1),
  };
};

export const getNodeTransformForPinnedWorldPoint = (
  node,
  bbox,
  localPoint,
  worldPoint
) => {
  const frame = getNodeTransformFrame(node, bbox);
  const rotatedOffset = rotateVector(
    {
      x: (localPoint.x - frame.localCenter.x) * frame.scaleX,
      y: (localPoint.y - frame.localCenter.y) * frame.scaleY,
    },
    frame.rotation
  );

  return {
    x: round(worldPoint.x - frame.localCenter.x - rotatedOffset.x, 2),
    y: round(worldPoint.y - frame.localCenter.y - rotatedOffset.y, 2),
  };
};

export const getNodeWorldPoint = (node, bbox, point) => {
  return getWorldPointFromTransformFrame(
    getNodeTransformFrame(node, bbox),
    point
  );
};

export const getNodeWorldBounds = (node, bbox) => {
  const frame = getNodeTransformFrame(node, bbox);
  const corners = [
    { x: bbox.minX, y: bbox.minY },
    { x: bbox.maxX, y: bbox.minY },
    { x: bbox.maxX, y: bbox.maxY },
    { x: bbox.minX, y: bbox.maxY },
  ].map((point) => getWorldPointFromTransformFrame(frame, point));
  const xs = corners.map((point) => point.x);
  const ys = corners.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return {
    height: maxY - minY,
    maxX,
    maxY,
    minX,
    minY,
    width: maxX - minX,
  };
};

export const getNodeLocalPoint = (node, bbox, point) => {
  return getLocalPointFromTransformFrame(
    getNodeTransformFrame(node, bbox),
    point
  );
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

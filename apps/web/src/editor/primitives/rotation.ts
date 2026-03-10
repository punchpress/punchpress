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
    x: node.x + localCenter.x,
    y: node.y + localCenter.y,
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
  const rotatedOffset = rotateVector(
    {
      x: point.x - localCenter.x,
      y: point.y - localCenter.y,
    },
    node.rotation || 0
  );

  return {
    x: worldCenter.x + rotatedOffset.x,
    y: worldCenter.y + rotatedOffset.y,
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
    rotation: round((baseNode.rotation || 0) + deltaRotation, 2),
    x: round(nextCenter.x - localCenter.x, 2),
    y: round(nextCenter.y - localCenter.y, 2),
  };
};

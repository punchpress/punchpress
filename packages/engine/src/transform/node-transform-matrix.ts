import { isContainerNode } from "../nodes/node-tree";
import {
  getNodeRotation,
  getNodeScaleX,
  getNodeScaleY,
  getNodeX,
  getNodeY,
} from "../nodes/text/model";
import { getLocalBoundsCenter } from "../primitives/rotation";

export const IDENTITY_MATRIX = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

export const multiplyMatrix = (left, right) => {
  return {
    a: left.a * right.a + left.c * right.b,
    b: left.b * right.a + left.d * right.b,
    c: left.a * right.c + left.c * right.d,
    d: left.b * right.c + left.d * right.d,
    e: left.a * right.e + left.c * right.f + left.e,
    f: left.b * right.e + left.d * right.f + left.f,
  };
};

export const applyMatrixToPoint = (matrix, point) => {
  return {
    x: matrix.a * point.x + matrix.c * point.y + matrix.e,
    y: matrix.b * point.x + matrix.d * point.y + matrix.f,
  };
};

export const invertMatrix = (matrix) => {
  const determinant = matrix.a * matrix.d - matrix.b * matrix.c;

  if (Math.abs(determinant) < 0.000001) {
    return null;
  }

  return {
    a: matrix.d / determinant,
    b: -matrix.b / determinant,
    c: -matrix.c / determinant,
    d: matrix.a / determinant,
    e: (matrix.c * matrix.f - matrix.d * matrix.e) / determinant,
    f: (matrix.b * matrix.e - matrix.a * matrix.f) / determinant,
  };
};

export const getMatrixRotation = (matrix) => {
  return (Math.atan2(matrix.b, matrix.a) * 180) / Math.PI;
};

export const getNodeLocalMatrix = (node, bbox) => {
  if (!(node && bbox)) {
    return IDENTITY_MATRIX;
  }

  const center = getLocalBoundsCenter(bbox);
  const rotation = ((getNodeRotation(node) || 0) * Math.PI) / 180;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const scaleX = getNodeScaleX(node) ?? 1;
  const scaleY = getNodeScaleY(node) ?? 1;
  const origin = {
    x: getNodeX(node) + center.x,
    y: getNodeY(node) + center.y,
  };

  return {
    a: cos * scaleX,
    b: sin * scaleX,
    c: -sin * scaleY,
    d: cos * scaleY,
    e: origin.x - (cos * scaleX * center.x - sin * scaleY * center.y),
    f: origin.y - (sin * scaleX * center.x + cos * scaleY * center.y),
  };
};

export const getTransformedBounds = (matrix, bounds) => {
  if (!bounds) {
    return null;
  }

  const points = [
    { x: bounds.minX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.maxY },
    { x: bounds.minX, y: bounds.maxY },
  ].map((point) => applyMatrixToPoint(matrix, point));
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
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

const unionBounds = (left, right) => {
  if (!left) {
    return right;
  }

  if (!right) {
    return left;
  }

  const minX = Math.min(left.minX, right.minX);
  const minY = Math.min(left.minY, right.minY);
  const maxX = Math.max(left.maxX, right.maxX);
  const maxY = Math.max(left.maxY, right.maxY);

  return {
    height: maxY - minY,
    maxX,
    maxY,
    minX,
    minY,
    width: maxX - minX,
  };
};

export const getNodeLocalTransformBounds = (
  editor,
  nodeId,
  baseNodes = null,
  visitedNodeIds = new Set()
) => {
  if (visitedNodeIds.has(nodeId)) {
    return null;
  }

  const node = baseNodes?.get(nodeId) || editor.getNode(nodeId);

  if (!node) {
    return null;
  }

  if (!isContainerNode(node)) {
    return (
      node.bbox ||
      editor.getNodeTransformBounds(nodeId) ||
      editor.getNodeRenderGeometry(nodeId)?.bbox ||
      null
    );
  }

  visitedNodeIds.add(nodeId);

  const bounds = editor
    .getChildNodeIds(nodeId)
    .reduce((currentBounds, childId) => {
      const childNode = baseNodes?.get(childId) || editor.getNode(childId);
      const childBounds = getNodeLocalTransformBounds(
        editor,
        childId,
        baseNodes,
        visitedNodeIds
      );

      if (!(childNode && childBounds)) {
        return currentBounds;
      }

      return unionBounds(
        currentBounds,
        getTransformedBounds(
          getNodeLocalMatrix(childNode, childBounds),
          childBounds
        )
      );
    }, null);

  visitedNodeIds.delete(nodeId);
  return bounds;
};

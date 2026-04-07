const HANDLE_EPSILON = 0.01;

export const clampNumber = (value, min, max) => {
  return Math.min(max, Math.max(min, value));
};

export const getPointDistance = (from, to) => {
  return Math.hypot(to.x - from.x, to.y - from.y);
};

export const getUnitVector = (point) => {
  const length = Math.hypot(point.x, point.y);

  if (length <= 0.0001) {
    return null;
  }

  return {
    x: point.x / length,
    y: point.y / length,
  };
};

export const hasHandle = (handle) => {
  return Boolean(
    handle &&
      (Math.abs(handle.x) > HANDLE_EPSILON ||
        Math.abs(handle.y) > HANDLE_EPSILON)
  );
};

export const getHandleLength = (handle) => {
  return Math.hypot(handle.x, handle.y);
};

export const cloneHandle = (handle) => {
  return {
    x: handle.x,
    y: handle.y,
  };
};

export const getRelativeHandle = (from, to) => {
  return {
    x: to.x - from.x,
    y: to.y - from.y,
  };
};

export const cloneSegment = (segment) => {
  return {
    ...segment,
    handleIn: cloneHandle(segment.handleIn),
    handleOut: cloneHandle(segment.handleOut),
    point: cloneHandle(segment.point),
  };
};

export const getLineIntersection = (pointA, directionA, pointB, directionB) => {
  const determinant = directionA.x * directionB.y - directionA.y * directionB.x;

  if (Math.abs(determinant) <= 0.0001) {
    return null;
  }

  const delta = {
    x: pointB.x - pointA.x,
    y: pointB.y - pointA.y,
  };
  const distanceA =
    (delta.x * directionB.y - delta.y * directionB.x) / determinant;
  const distanceB =
    (delta.x * directionA.y - delta.y * directionA.x) / determinant;

  return {
    distanceA,
    distanceB,
    point: {
      x: pointA.x + directionA.x * distanceA,
      y: pointA.y + directionA.y * distanceA,
    },
  };
};

export const getVectorCornerKey = (contourIndex, segmentIndex) => {
  return `vector:${contourIndex}:${segmentIndex}`;
};

export const getRoundCornerHandleLength = (cornerAngle, radius) => {
  const turnAngle = Math.PI - cornerAngle;

  return (4 / 3) * Math.tan(turnAngle / 4) * Math.max(radius, 0);
};

export const getCornerCutDistanceForRadius = (control, radius) => {
  if (!control) {
    return 0;
  }

  return radius / Math.tan(control.cornerAngle / 2);
};

export const getCornerCutDistance = (control) => {
  return getCornerCutDistanceForRadius(control, control?.currentRadius ?? 0);
};

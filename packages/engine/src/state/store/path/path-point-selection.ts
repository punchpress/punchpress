export const toPathPointKey = (point) => {
  return `${point.contourIndex}:${point.segmentIndex}`;
};

export const normalizePathPoint = (point) => {
  if (
    !point ||
    typeof point.contourIndex !== "number" ||
    typeof point.segmentIndex !== "number"
  ) {
    return null;
  }

  return {
    contourIndex: point.contourIndex,
    segmentIndex: point.segmentIndex,
  };
};

export const isSamePathPoint = (a, b) => {
  return Boolean(
    a &&
      b &&
      a.contourIndex === b.contourIndex &&
      a.segmentIndex === b.segmentIndex
  );
};

export const includesPathPoint = (points, point) => {
  return (points || []).some((currentPoint) => {
    return isSamePathPoint(currentPoint, point);
  });
};

export const normalizePathPointSelection = (points, primaryPoint = null) => {
  const normalizedPoints: Array<{
    contourIndex: number;
    segmentIndex: number;
  }> = [];
  const seenKeys = new Set();

  for (const point of points || []) {
    const normalizedPoint = normalizePathPoint(point);

    if (!normalizedPoint) {
      continue;
    }

    const key = toPathPointKey(normalizedPoint);

    if (seenKeys.has(key)) {
      continue;
    }

    seenKeys.add(key);
    normalizedPoints.push(normalizedPoint);
  }

  const normalizedPrimaryPoint = normalizePathPoint(primaryPoint);

  if (!normalizedPrimaryPoint) {
    return {
      pathEditingPoint:
        normalizedPoints.length === 1 ? normalizedPoints[0] || null : null,
      pathEditingPoints: normalizedPoints,
    };
  }

  const primaryKey = toPathPointKey(normalizedPrimaryPoint);

  if (!seenKeys.has(primaryKey)) {
    normalizedPoints.push(normalizedPrimaryPoint);
  }

  return {
    pathEditingPoint: normalizedPrimaryPoint,
    pathEditingPoints: normalizedPoints,
  };
};

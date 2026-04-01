const toPathPointKey = (point) => {
  return `${point.contourIndex}:${point.segmentIndex}`;
};

const normalizePathPoint = (point) => {
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

export const normalizePathPointSelection = (points, primaryPoint = null) => {
  const normalizedPoints = [];
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
      pathEditingPoint: normalizedPoints[0] || null,
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

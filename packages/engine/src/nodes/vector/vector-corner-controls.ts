const HANDLE_EPSILON = 0.01;
const MIN_CORNER_ANGLE = 0.001;

const clampNumber = (value, min, max) => {
  return Math.min(max, Math.max(min, value));
};

const hasHandle = (handle) => {
  return Boolean(
    handle &&
      (Math.abs(handle.x) > HANDLE_EPSILON || Math.abs(handle.y) > HANDLE_EPSILON)
  );
};

const getPointDistance = (from, to) => {
  return Math.hypot(to.x - from.x, to.y - from.y);
};

const getNormalizedDirection = (from, to) => {
  const length = getPointDistance(from, to);

  if (length <= 0.0001) {
    return null;
  }

  return {
    x: (to.x - from.x) / length,
    y: (to.y - from.y) / length,
  };
};

const getUnitVector = (point) => {
  const length = Math.hypot(point.x, point.y);

  if (length <= 0.0001) {
    return null;
  }

  return {
    x: point.x / length,
    y: point.y / length,
  };
};

const getPreviousSegmentIndex = (contour, segmentIndex) => {
  if (segmentIndex > 0) {
    return segmentIndex - 1;
  }

  return contour.closed ? contour.segments.length - 1 : -1;
};

const getNextSegmentIndex = (contour, segmentIndex) => {
  if (segmentIndex < contour.segments.length - 1) {
    return segmentIndex + 1;
  }

  return contour.closed ? 0 : -1;
};

export const canVectorSegmentHaveLiveCorner = (contour, segmentIndex) => {
  const segment = contour?.segments?.[segmentIndex];

  if (!(segment && segment.pointType === "corner")) {
    return false;
  }

  const previousIndex = getPreviousSegmentIndex(contour, segmentIndex);
  const nextIndex = getNextSegmentIndex(contour, segmentIndex);

  if (previousIndex < 0 || nextIndex < 0) {
    return false;
  }

  const previousSegment = contour.segments[previousIndex];
  const nextSegment = contour.segments[nextIndex];

  if (!(previousSegment && nextSegment)) {
    return false;
  }

  if (
    hasHandle(previousSegment.handleOut) ||
    hasHandle(segment.handleIn) ||
    hasHandle(segment.handleOut) ||
    hasHandle(nextSegment.handleIn)
  ) {
    return false;
  }

  const previousDirection = getNormalizedDirection(segment.point, previousSegment.point);
  const nextDirection = getNormalizedDirection(segment.point, nextSegment.point);

  if (!(previousDirection && nextDirection)) {
    return false;
  }

  const cornerAngle = Math.acos(
    clampNumber(
      previousDirection.x * nextDirection.x +
        previousDirection.y * nextDirection.y,
      -1,
      1
    )
  );

  return (
    Number.isFinite(cornerAngle) &&
    cornerAngle > MIN_CORNER_ANGLE &&
    Math.abs(Math.PI - cornerAngle) > MIN_CORNER_ANGLE
  );
};

export const getVectorPointCornerRadius = (contours, point) => {
  return contours?.[point?.contourIndex]?.segments?.[point?.segmentIndex]?.cornerRadius ?? 0;
};

export const canRoundVectorPoint = (contours, point) => {
  const contour = contours?.[point?.contourIndex];

  if (!(contour && typeof point?.segmentIndex === "number")) {
    return false;
  }

  return canVectorSegmentHaveLiveCorner(contour, point.segmentIndex);
};

const getRoundableVectorPoints = (contours) => {
  if (!contours?.length) {
    return [];
  }

  return contours.flatMap((contour, contourIndex) => {
    return contour.segments.flatMap((_, segmentIndex) => {
      return canVectorSegmentHaveLiveCorner(contour, segmentIndex)
        ? [{ contourIndex, segmentIndex }]
        : [];
    });
  });
};

export const getEligibleVectorCornerPoints = (contours, points = null) => {
  if (!points?.length) {
    return getRoundableVectorPoints(contours);
  }

  const seenPointKeys = new Set();

  return points.filter((point) => {
    const pointKey = `${point.contourIndex}:${point.segmentIndex}`;

    if (seenPointKeys.has(pointKey)) {
      return false;
    }

    seenPointKeys.add(pointKey);
    return canRoundVectorPoint(contours, point);
  });
};

export const getVectorPointCornerControl = (contours, point) => {
  const contour = contours?.[point?.contourIndex];
  const segmentIndex = point?.segmentIndex;

  if (!(contour && typeof segmentIndex === "number")) {
    return null;
  }

  if (!canVectorSegmentHaveLiveCorner(contour, segmentIndex)) {
    return null;
  }

  const segment = contour.segments[segmentIndex];
  const previousSegment = contour.segments[getPreviousSegmentIndex(contour, segmentIndex)];
  const nextSegment = contour.segments[getNextSegmentIndex(contour, segmentIndex)];
  const previousDirection = getNormalizedDirection(segment.point, previousSegment.point);
  const nextDirection = getNormalizedDirection(segment.point, nextSegment.point);

  if (!(previousDirection && nextDirection)) {
    return null;
  }

  const cornerAngle = Math.acos(
    clampNumber(
      previousDirection.x * nextDirection.x +
        previousDirection.y * nextDirection.y,
      -1,
      1
    )
  );
  const bisector = getUnitVector({
    x: previousDirection.x + nextDirection.x,
    y: previousDirection.y + nextDirection.y,
  });

  if (
    !(
      bisector &&
      Number.isFinite(cornerAngle) &&
      cornerAngle > MIN_CORNER_ANGLE &&
      Math.abs(Math.PI - cornerAngle) > MIN_CORNER_ANGLE
    )
  ) {
    return null;
  }

  const previousLength = getPointDistance(segment.point, previousSegment.point);
  const nextLength = getPointDistance(segment.point, nextSegment.point);
  const maxCutDistance = Math.min(previousLength, nextLength) / 2;
  const maxRadius = maxCutDistance * Math.tan(cornerAngle / 2);

  return {
    anchor: segment.point,
    bisector,
    cornerAngle,
    currentRadius: clampNumber(segment.cornerRadius ?? 0, 0, maxRadius),
    maxRadius,
  };
};

export const getVectorCornerRadiusSummary = (contours, points = null) => {
  const eligiblePoints = getEligibleVectorCornerPoints(contours, points);

  if (eligiblePoints.length === 0) {
    return null;
  }

  const controls = eligiblePoints
    .map((point) => getVectorPointCornerControl(contours, point))
    .filter(Boolean);
  const values = controls.map((control) => control.currentRadius);
  const [firstValue = 0] = values;
  const isMixed = values.some((value) => value !== firstValue);
  const max = controls.reduce((currentMax, control) => {
    return Math.max(currentMax, control.maxRadius);
  }, 0);

  return {
    eligibleCount: eligiblePoints.length,
    isMixed,
    max,
    value: isMixed ? null : firstValue,
  };
};

export const getUniformVectorCornerRadius = (contours) => {
  const summary = getVectorCornerRadiusSummary(contours);

  if (!(summary && !summary.isMixed)) {
    return null;
  }

  return summary.value ?? 0;
};

export const setVectorPointCornerRadius = (contours, point, cornerRadius) => {
  const nextCornerRadius = Math.max(0, cornerRadius || 0);

  if (!(contours && point)) {
    return null;
  }

  if (nextCornerRadius > 0 && !canRoundVectorPoint(contours, point)) {
    return null;
  }

  return contours.map((contour, contourIndex) => {
    if (contourIndex !== point.contourIndex) {
      return contour;
    }

    return {
      ...contour,
      segments: contour.segments.map((segment, segmentIndex) => {
        if (segmentIndex !== point.segmentIndex) {
          return segment;
        }

        if (nextCornerRadius <= 0) {
          const { cornerRadius: _cornerRadius, ...rest } = segment;
          return rest;
        }

        return {
          ...segment,
          cornerRadius: nextCornerRadius,
        };
      }),
    };
  });
};

export const setAllVectorPointCornerRadii = (
  contours,
  cornerRadius,
  points = null
) => {
  const nextCornerRadius = Math.max(0, cornerRadius || 0);
  const eligiblePoints = getEligibleVectorCornerPoints(contours, points);

  if (!(contours && eligiblePoints.length > 0)) {
    return null;
  }

  const eligiblePointKeys = new Set(
    eligiblePoints.map((point) => `${point.contourIndex}:${point.segmentIndex}`)
  );

  return contours.map((contour, contourIndex) => {
    return {
      ...contour,
      segments: contour.segments.map((segment, segmentIndex) => {
        if (!eligiblePointKeys.has(`${contourIndex}:${segmentIndex}`)) {
          return segment;
        }

        if (nextCornerRadius <= 0) {
          const { cornerRadius: _cornerRadius, ...rest } = segment;
          return rest;
        }

        return {
          ...segment,
          cornerRadius: nextCornerRadius,
        };
      }),
    };
  });
};

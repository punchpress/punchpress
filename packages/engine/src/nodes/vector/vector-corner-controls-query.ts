import {
  areCornerRadiiEquivalent,
  clampCornerRadius,
  normalizeCornerRadius,
} from "../../primitives/corner-radius";
import {
  clampNumber,
  getHandleLength,
  getLineIntersection,
  getPointDistance,
  getRoundCornerHandleLength,
  getUnitVector,
  getVectorCornerKey,
  hasHandle,
} from "./vector-corner-controls-shared";
import {
  getNextVectorSegmentIndex,
  getPreviousVectorSegmentIndex,
  getVectorCurveControlPoints,
  getVectorCurveLength,
  getVectorCurveParameterAtDistance,
  getVectorCurvePointAt,
  isVectorCurveEffectivelyLine,
} from "./vector-curve";

const MIN_CORNER_ANGLE = 0.001;
const CORNER_DIRECTION_SAMPLE_DISTANCE = 12;
const getDetectedRoundCornerNeighbors = (contour, startIndex) => {
  const startSegment = contour?.segments?.[startIndex];
  const previousIndex = getPreviousVectorSegmentIndex(contour, startIndex);
  const endIndex = getNextVectorSegmentIndex(contour, startIndex);
  const nextIndex =
    typeof endIndex === "number" && endIndex >= 0
      ? getNextVectorSegmentIndex(contour, endIndex)
      : -1;
  const previousSegment =
    previousIndex >= 0 ? contour.segments[previousIndex] : null;
  const endSegment = endIndex >= 0 ? contour.segments[endIndex] : null;
  const nextSegment = nextIndex >= 0 ? contour.segments[nextIndex] : null;

  if (!(startSegment && previousSegment && endSegment && nextSegment)) {
    return null;
  }

  if (
    hasHandle(startSegment.handleIn) ||
    !hasHandle(startSegment.handleOut) ||
    !hasHandle(endSegment.handleIn) ||
    hasHandle(endSegment.handleOut) ||
    hasHandle(previousSegment.handleOut) ||
    hasHandle(nextSegment.handleIn)
  ) {
    return null;
  }

  return {
    endIndex,
    endSegment,
    nextIndex,
    nextSegment,
    previousIndex,
    previousSegment,
    startSegment,
  };
};

const getCornerSide = (contour, segmentIndex, side: "previous" | "next") => {
  const curveIndex =
    side === "previous"
      ? getPreviousVectorSegmentIndex(contour, segmentIndex)
      : segmentIndex;
  const curve =
    curveIndex >= 0 ? getVectorCurveControlPoints(contour, curveIndex) : null;

  if (!curve) {
    return null;
  }

  const curveLength = getVectorCurveLength(curve);

  if (curveLength <= 0.0001) {
    return null;
  }

  const anchor = side === "previous" ? curve.p3 : curve.p0;
  const sampleDistance = Math.min(
    curveLength / 4,
    CORNER_DIRECTION_SAMPLE_DISTANCE
  );
  const t = getVectorCurveParameterAtDistance(curve, sampleDistance, {
    fromEnd: side === "previous",
  });
  const samplePoint = getVectorCurvePointAt(curve, t);
  const direction = getUnitVector({
    x: samplePoint.x - anchor.x,
    y: samplePoint.y - anchor.y,
  });

  if (!direction) {
    return null;
  }

  return {
    curve,
    curveLength,
    direction,
  };
};

export const getVectorSegmentCornerControl = (contour, segmentIndex) => {
  const segment = contour?.segments?.[segmentIndex];

  if (!(segment && segment.pointType === "corner")) {
    return null;
  }

  const previousIndex = getPreviousVectorSegmentIndex(contour, segmentIndex);
  const nextIndex = getNextVectorSegmentIndex(contour, segmentIndex);

  if (previousIndex < 0 || nextIndex < 0) {
    return null;
  }

  if (hasHandle(segment.handleIn) || hasHandle(segment.handleOut)) {
    return null;
  }

  const previousSide = getCornerSide(contour, segmentIndex, "previous");
  const nextSide = getCornerSide(contour, segmentIndex, "next");

  if (!(previousSide && nextSide)) {
    return null;
  }

  if (
    !(
      isVectorCurveEffectivelyLine(previousSide.curve) &&
      isVectorCurveEffectivelyLine(nextSide.curve)
    )
  ) {
    return null;
  }

  const cornerAngle = Math.acos(
    clampNumber(
      previousSide.direction.x * nextSide.direction.x +
        previousSide.direction.y * nextSide.direction.y,
      -1,
      1
    )
  );
  const bisector = getUnitVector({
    x: previousSide.direction.x + nextSide.direction.x,
    y: previousSide.direction.y + nextSide.direction.y,
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

  const maxCutDistance =
    Math.min(previousSide.curveLength, nextSide.curveLength) / 2;
  const maxRadius = maxCutDistance * Math.tan(cornerAngle / 2);

  return {
    anchor: segment.point,
    bisector,
    cornerAngle,
    currentRadius: 0,
    kind: "sharp",
    maxRadius: normalizeCornerRadius(maxRadius),
    nextCurve: nextSide.curve,
    nextCurveLength: nextSide.curveLength,
    nextDirection: nextSide.direction,
    previousCurve: previousSide.curve,
    previousCurveLength: previousSide.curveLength,
    previousDirection: previousSide.direction,
    segmentIndex,
  };
};

const getDetectedVectorRoundCornerControlFromStart = (
  contour,
  contourIndex,
  startIndex,
  selectedSegmentIndex = startIndex
) => {
  const neighbors = getDetectedRoundCornerNeighbors(contour, startIndex);

  if (!neighbors) {
    return null;
  }

  const {
    endIndex,
    endSegment,
    nextIndex,
    nextSegment,
    previousIndex,
    previousSegment,
    startSegment,
  } = neighbors;

  const startTowardCorner = getUnitVector({
    x: startSegment.point.x - previousSegment.point.x,
    y: startSegment.point.y - previousSegment.point.y,
  });
  const endTowardCorner = getUnitVector({
    x: endSegment.point.x - nextSegment.point.x,
    y: endSegment.point.y - nextSegment.point.y,
  });

  if (!(startTowardCorner && endTowardCorner)) {
    return null;
  }

  const virtualCorner = getLineIntersection(
    startSegment.point,
    startTowardCorner,
    endSegment.point,
    endTowardCorner
  );

  if (
    !(
      virtualCorner &&
      virtualCorner.distanceA > 0.0001 &&
      virtualCorner.distanceB > 0.0001
    )
  ) {
    return null;
  }

  if (Math.abs(virtualCorner.distanceA - virtualCorner.distanceB) > 0.5) {
    return null;
  }

  const startSideDirection = getUnitVector({
    x: startSegment.point.x - virtualCorner.point.x,
    y: startSegment.point.y - virtualCorner.point.y,
  });
  const endSideDirection = getUnitVector({
    x: endSegment.point.x - virtualCorner.point.x,
    y: endSegment.point.y - virtualCorner.point.y,
  });

  if (!(startSideDirection && endSideDirection)) {
    return null;
  }

  const cornerAngle = Math.acos(
    clampNumber(
      startSideDirection.x * endSideDirection.x +
        startSideDirection.y * endSideDirection.y,
      -1,
      1
    )
  );
  const bisector = getUnitVector({
    x: startSideDirection.x + endSideDirection.x,
    y: startSideDirection.y + endSideDirection.y,
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

  const currentRadius = normalizeCornerRadius(
    virtualCorner.distanceA * Math.tan(cornerAngle / 2)
  );
  const expectedHandleLength = getRoundCornerHandleLength(
    cornerAngle,
    currentRadius
  );
  const startHandleDirection = getUnitVector(startSegment.handleOut);
  const endHandleDirection = getUnitVector(endSegment.handleIn);

  if (!(startHandleDirection && endHandleDirection)) {
    return null;
  }

  const startAlignment =
    startHandleDirection.x * startTowardCorner.x +
    startHandleDirection.y * startTowardCorner.y;
  const endAlignment =
    endHandleDirection.x * endTowardCorner.x +
    endHandleDirection.y * endTowardCorner.y;

  if (
    startAlignment < 0.999 ||
    endAlignment < 0.999 ||
    Math.abs(getHandleLength(startSegment.handleOut) - expectedHandleLength) >
      0.5 ||
    Math.abs(getHandleLength(endSegment.handleIn) - expectedHandleLength) > 0.5
  ) {
    return null;
  }

  const maxCutDistance =
    Math.min(
      getPointDistance(virtualCorner.point, previousSegment.point),
      getPointDistance(virtualCorner.point, nextSegment.point)
    ) / 2;

  return {
    anchor: virtualCorner.point,
    bisector,
    cornerAngle,
    contourIndex,
    currentRadius,
    endIndex,
    kind: "detected",
    key: getVectorCornerKey(contourIndex, startIndex),
    maxRadius: normalizeCornerRadius(
      maxCutDistance * Math.tan(cornerAngle / 2)
    ),
    nextIndex,
    previousIndex,
    selectedSegmentIndex,
    startIndex,
    virtualCorner: virtualCorner.point,
  };
};

const getDetectedVectorRoundCornerControl = (
  contours,
  contourIndex,
  segmentIndex
) => {
  const contour = contours?.[contourIndex];

  if (!(contour && typeof segmentIndex === "number")) {
    return null;
  }

  return (
    getDetectedVectorRoundCornerControlFromStart(
      contour,
      contourIndex,
      segmentIndex
    ) ||
    getDetectedVectorRoundCornerControlFromStart(
      contour,
      contourIndex,
      getPreviousVectorSegmentIndex(contour, segmentIndex),
      segmentIndex
    )
  );
};

export const canVectorSegmentHaveLiveCorner = (contour, segmentIndex) => {
  return Boolean(getVectorSegmentCornerControl(contour, segmentIndex));
};

export const getVectorPointCornerDescriptor = (contours, point) => {
  const contourIndex = point?.contourIndex;
  const segmentIndex = point?.segmentIndex;
  const contour = contours?.[contourIndex];

  if (!(contour && typeof segmentIndex === "number")) {
    return null;
  }

  const sharpControl = getVectorSegmentCornerControl(contour, segmentIndex);

  if (sharpControl) {
    return {
      ...sharpControl,
      contourIndex,
      key: getVectorCornerKey(contourIndex, segmentIndex),
    };
  }

  return getDetectedVectorRoundCornerControl(
    contours,
    contourIndex,
    segmentIndex
  );
};

export const getVectorPointCornerRadius = (contours, point) => {
  return clampCornerRadius(
    getVectorPointCornerDescriptor(contours, point)?.currentRadius ?? 0
  );
};

export const canRoundVectorPoint = (contours, point) => {
  return Boolean(getVectorPointCornerDescriptor(contours, point));
};

export const getRoundableVectorPoints = (contours) => {
  if (!contours?.length) {
    return [];
  }

  const seenCornerKeys = new Set();

  return contours.flatMap((contour, contourIndex) => {
    return contour.segments.flatMap((_, segmentIndex) => {
      const descriptor = getVectorPointCornerDescriptor(contours, {
        contourIndex,
        segmentIndex,
      });

      if (!(descriptor && !seenCornerKeys.has(descriptor.key))) {
        return [];
      }

      seenCornerKeys.add(descriptor.key);

      return [{ contourIndex, segmentIndex }];
    });
  });
};

export const getEligibleVectorCornerPoints = (contours, points = null) => {
  if (!points?.length) {
    return getRoundableVectorPoints(contours);
  }

  const seenCornerKeys = new Set();

  return points.filter((point) => {
    const descriptor = getVectorPointCornerDescriptor(contours, point);

    if (!(descriptor && !seenCornerKeys.has(descriptor.key))) {
      return false;
    }

    seenCornerKeys.add(descriptor.key);
    return true;
  });
};

export const getVectorPointCornerControl = (contours, point) => {
  return getVectorPointCornerDescriptor(contours, point);
};

export const getVectorCornerRadiusSummary = (contours, points = null) => {
  const eligiblePoints = getEligibleVectorCornerPoints(contours, points);

  if (eligiblePoints.length === 0) {
    return null;
  }

  const controls = eligiblePoints
    .map((point) => getVectorPointCornerControl(contours, point))
    .filter(Boolean);
  const values = controls.map((control) => {
    return clampCornerRadius(control.currentRadius);
  });
  const [firstValue = 0] = values;
  const isMixed = values.some((value) => {
    return !areCornerRadiiEquivalent(value, firstValue);
  });
  const max = controls.reduce((currentMax, control) => {
    return Math.max(currentMax, clampCornerRadius(control.maxRadius));
  }, 0);
  const value = isMixed
    ? null
    : normalizeCornerRadius(
        values.reduce((sum, currentValue) => sum + currentValue, 0) /
          Math.max(values.length, 1)
      );

  return {
    eligibleCount: eligiblePoints.length,
    isMixed,
    max: normalizeCornerRadius(max),
    value,
  };
};

export const getUniformVectorCornerRadius = (contours) => {
  const summary = getVectorCornerRadiusSummary(contours);

  if (!(summary && !summary.isMixed)) {
    return null;
  }

  return summary.value ?? 0;
};

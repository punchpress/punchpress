import type {
  VectorContourDocument,
  VectorHandleDocument,
  VectorPointDocument,
  VectorSegmentDocument,
} from "@punchpress/punch-schema";

const CURVE_ENDPOINT_EPSILON = 0.001;
const CURVE_REFINE_STEPS = 6;
const CURVE_SAMPLE_STEPS = 24;
const HANDLE_EPSILON = 0.01;

const cloneHandle = (
  handle: VectorPointDocument | VectorHandleDocument
): VectorHandleDocument => {
  return {
    x: handle.x,
    y: handle.y,
  };
};

const cloneSegment = (
  segment: VectorSegmentDocument
): VectorSegmentDocument => {
  return {
    ...segment,
    handleIn: cloneHandle(segment.handleIn),
    handleOut: cloneHandle(segment.handleOut),
    point: cloneHandle(segment.point),
  };
};

const getPointType = (segment: VectorSegmentDocument) => {
  return Math.hypot(segment.handleIn.x, segment.handleIn.y) > HANDLE_EPSILON ||
    Math.hypot(segment.handleOut.x, segment.handleOut.y) > HANDLE_EPSILON
    ? "smooth"
    : "corner";
};

const getCurveCount = (contour: VectorContourDocument) => {
  if (contour.closed) {
    return contour.segments.length;
  }

  return Math.max(contour.segments.length - 1, 0);
};

const lerpPoint = (
  from: VectorPointDocument | VectorHandleDocument,
  to: VectorPointDocument | VectorHandleDocument,
  t: number
) => {
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
  };
};

const getCurveControlPoints = (
  contour: VectorContourDocument,
  curveIndex: number
) => {
  const current = contour.segments[curveIndex];
  const nextIndex =
    curveIndex === contour.segments.length - 1 ? 0 : curveIndex + 1;
  const next = contour.segments[nextIndex];

  if (!(current && next)) {
    return null;
  }

  return {
    nextIndex,
    p0: current.point,
    p1: {
      x: current.point.x + current.handleOut.x,
      y: current.point.y + current.handleOut.y,
    },
    p2: {
      x: next.point.x + next.handleIn.x,
      y: next.point.y + next.handleIn.y,
    },
    p3: next.point,
  };
};

const getCurvePointAt = (
  contour: VectorContourDocument,
  curveIndex: number,
  t: number
) => {
  const points = getCurveControlPoints(contour, curveIndex);

  if (!points) {
    return null;
  }

  if (isStraightLineCurve(points)) {
    return lerpPoint(points.p0, points.p3, t);
  }

  const q0 = lerpPoint(points.p0, points.p1, t);
  const q1 = lerpPoint(points.p1, points.p2, t);
  const q2 = lerpPoint(points.p2, points.p3, t);
  const r0 = lerpPoint(q0, q1, t);
  const r1 = lerpPoint(q1, q2, t);

  return lerpPoint(r0, r1, t);
};

const getDistance = (
  a: VectorPointDocument | VectorHandleDocument,
  b: VectorPointDocument | VectorHandleDocument
) => {
  return Math.hypot(a.x - b.x, a.y - b.y);
};

const isStraightLineCurve = (
  points: NonNullable<ReturnType<typeof getCurveControlPoints>>
) => {
  return (
    getDistance(points.p0, points.p1) <= HANDLE_EPSILON &&
    getDistance(points.p2, points.p3) <= HANDLE_EPSILON
  );
};

const getStraightLineParameter = (
  points: NonNullable<ReturnType<typeof getCurveControlPoints>>,
  point: VectorPointDocument
) => {
  const deltaX = points.p3.x - points.p0.x;
  const deltaY = points.p3.y - points.p0.y;
  const lengthSquared = deltaX * deltaX + deltaY * deltaY;

  if (lengthSquared <= HANDLE_EPSILON) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(
      1,
      ((point.x - points.p0.x) * deltaX + (point.y - points.p0.y) * deltaY) /
        lengthSquared
    )
  );
};

const findNearestCurveParameter = (
  contour: VectorContourDocument,
  curveIndex: number,
  point: VectorPointDocument
) => {
  const controlPoints = getCurveControlPoints(contour, curveIndex);

  if (!controlPoints) {
    return 0;
  }

  if (isStraightLineCurve(controlPoints)) {
    return getStraightLineParameter(controlPoints, point);
  }

  let bestT = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let step = 0; step <= CURVE_SAMPLE_STEPS; step += 1) {
    const t = step / CURVE_SAMPLE_STEPS;
    const curvePoint = getCurvePointAt(contour, curveIndex, t);

    if (!curvePoint) {
      continue;
    }

    const distance = getDistance(curvePoint, point);

    if (distance >= bestDistance) {
      continue;
    }

    bestDistance = distance;
    bestT = t;
  }

  let low = Math.max(bestT - 1 / CURVE_SAMPLE_STEPS, 0);
  let high = Math.min(bestT + 1 / CURVE_SAMPLE_STEPS, 1);

  for (let step = 0; step < CURVE_REFINE_STEPS; step += 1) {
    const left = low + (high - low) / 3;
    const right = high - (high - low) / 3;
    const leftPoint = getCurvePointAt(contour, curveIndex, left);
    const rightPoint = getCurvePointAt(contour, curveIndex, right);

    if (!(leftPoint && rightPoint)) {
      break;
    }

    if (getDistance(leftPoint, point) <= getDistance(rightPoint, point)) {
      high = right;
    } else {
      low = left;
    }
  }

  return (low + high) / 2;
};

export const findVectorPathInsertTarget = (
  contours: VectorContourDocument[],
  point: VectorPointDocument,
  tolerance: number
) => {
  let bestTarget: null | {
    contourIndex: number;
    curveIndex: number;
    distance: number;
    t: number;
  } = null;

  for (const [contourIndex, contour] of contours.entries()) {
    const curveCount = getCurveCount(contour);

    for (let curveIndex = 0; curveIndex < curveCount; curveIndex += 1) {
      const t = findNearestCurveParameter(contour, curveIndex, point);

      if (t <= CURVE_ENDPOINT_EPSILON || t >= 1 - CURVE_ENDPOINT_EPSILON) {
        continue;
      }

      const curvePoint = getCurvePointAt(contour, curveIndex, t);

      if (!curvePoint) {
        continue;
      }

      const distance = getDistance(curvePoint, point);

      if (
        distance > tolerance ||
        (bestTarget && distance >= bestTarget.distance)
      ) {
        continue;
      }

      bestTarget = {
        contourIndex,
        curveIndex,
        distance,
        t,
      };
    }
  }

  if (!bestTarget) {
    return null;
  }

  return {
    contourIndex: bestTarget.contourIndex,
    curveIndex: bestTarget.curveIndex,
    t: bestTarget.t,
  };
};

export const splitVectorContourAtParameter = (
  contour: VectorContourDocument,
  target: {
    contourIndex: number;
    curveIndex: number;
    t: number;
  }
) => {
  const controlPoints = getCurveControlPoints(contour, target.curveIndex);

  if (!controlPoints) {
    return null;
  }

  if (isStraightLineCurve(controlPoints)) {
    const segments = contour.segments.map(cloneSegment);
    const insertIndex =
      controlPoints.nextIndex === 0 ? segments.length : controlPoints.nextIndex;

    segments.splice(insertIndex, 0, {
      handleIn: { x: 0, y: 0 },
      handleOut: { x: 0, y: 0 },
      point: lerpPoint(controlPoints.p0, controlPoints.p3, target.t),
      pointType: "corner",
    });

    return {
      contourIndex: target.contourIndex,
      segmentIndex: insertIndex,
      segments,
    };
  }

  const q0 = lerpPoint(controlPoints.p0, controlPoints.p1, target.t);
  const q1 = lerpPoint(controlPoints.p1, controlPoints.p2, target.t);
  const q2 = lerpPoint(controlPoints.p2, controlPoints.p3, target.t);
  const r0 = lerpPoint(q0, q1, target.t);
  const r1 = lerpPoint(q1, q2, target.t);
  const point = lerpPoint(r0, r1, target.t);
  const segments = contour.segments.map(cloneSegment);
  const insertIndex =
    controlPoints.nextIndex === 0 ? segments.length : controlPoints.nextIndex;
  const insertedSegment: VectorSegmentDocument = {
    handleIn: {
      x: r0.x - point.x,
      y: r0.y - point.y,
    },
    handleOut: {
      x: r1.x - point.x,
      y: r1.y - point.y,
    },
    point,
    pointType: "corner",
  };

  insertedSegment.pointType = getPointType(insertedSegment);
  segments[target.curveIndex] = {
    ...segments[target.curveIndex],
    handleOut: {
      x: q0.x - controlPoints.p0.x,
      y: q0.y - controlPoints.p0.y,
    },
  };
  segments[controlPoints.nextIndex] = {
    ...segments[controlPoints.nextIndex],
    handleIn: {
      x: q2.x - controlPoints.p3.x,
      y: q2.y - controlPoints.p3.y,
    },
  };
  segments.splice(insertIndex, 0, insertedSegment);

  return {
    contourIndex: target.contourIndex,
    segmentIndex: insertIndex,
    segments,
  };
};

export const insertVectorPoint = (
  contours: VectorContourDocument[],
  target: {
    contourIndex: number;
    segments: VectorSegmentDocument[];
  }
) => {
  return contours.map((contour, contourIndex) => {
    if (contourIndex !== target.contourIndex) {
      return contour;
    }

    return {
      ...contour,
      segments: target.segments.map(cloneSegment),
    };
  });
};

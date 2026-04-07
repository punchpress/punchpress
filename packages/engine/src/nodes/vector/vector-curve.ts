import type {
  VectorContourDocument,
  VectorHandleDocument,
  VectorPointDocument,
} from "@punchpress/punch-schema";

const CURVE_SAMPLE_STEPS = 24;
const DIRECTION_EPSILON = 0.0001;
const HANDLE_EPSILON = 0.01;

const clampNumber = (value, min, max) => {
  return Math.min(max, Math.max(min, value));
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

const addHandleToPoint = (point, handle) => {
  return {
    x: point.x + handle.x,
    y: point.y + handle.y,
  };
};

const getDistance = (
  a: VectorPointDocument | VectorHandleDocument,
  b: VectorPointDocument | VectorHandleDocument
) => {
  return Math.hypot(a.x - b.x, a.y - b.y);
};

const getDistanceToLine = (point, lineStart, lineEnd) => {
  const denominator = Math.hypot(
    lineEnd.x - lineStart.x,
    lineEnd.y - lineStart.y
  );

  if (denominator <= DIRECTION_EPSILON) {
    return getDistance(point, lineStart);
  }

  const numerator = Math.abs(
    (lineEnd.y - lineStart.y) * point.x -
      (lineEnd.x - lineStart.x) * point.y +
      lineEnd.x * lineStart.y -
      lineEnd.y * lineStart.x
  );

  return numerator / denominator;
};

export const normalizeVectorPoint = (point) => {
  const length = Math.hypot(point.x, point.y);

  if (length <= DIRECTION_EPSILON) {
    return null;
  }

  return {
    x: point.x / length,
    y: point.y / length,
  };
};

export const getPreviousVectorSegmentIndex = (contour, segmentIndex) => {
  if (segmentIndex > 0) {
    return segmentIndex - 1;
  }

  return contour.closed ? contour.segments.length - 1 : -1;
};

export const getNextVectorSegmentIndex = (contour, segmentIndex) => {
  if (segmentIndex < contour.segments.length - 1) {
    return segmentIndex + 1;
  }

  return contour.closed ? 0 : -1;
};

export const getVectorCurveControlPoints = (
  contour: VectorContourDocument,
  curveIndex: number
) => {
  const current = contour.segments[curveIndex];
  const nextIndex = getNextVectorSegmentIndex(contour, curveIndex);
  const next = nextIndex >= 0 ? contour.segments[nextIndex] : null;

  if (!(current && next)) {
    return null;
  }

  return {
    nextIndex,
    p0: current.point,
    p1: addHandleToPoint(current.point, current.handleOut),
    p2: addHandleToPoint(next.point, next.handleIn),
    p3: next.point,
  };
};

export const getVectorCurvePointAt = (curve, t: number) => {
  const q0 = lerpPoint(curve.p0, curve.p1, t);
  const q1 = lerpPoint(curve.p1, curve.p2, t);
  const q2 = lerpPoint(curve.p2, curve.p3, t);
  const r0 = lerpPoint(q0, q1, t);
  const r1 = lerpPoint(q1, q2, t);

  return lerpPoint(r0, r1, t);
};

export const getVectorCurveDerivativeAt = (curve, t: number) => {
  const mt = 1 - t;

  return {
    x:
      3 * mt * mt * (curve.p1.x - curve.p0.x) +
      6 * mt * t * (curve.p2.x - curve.p1.x) +
      3 * t * t * (curve.p3.x - curve.p2.x),
    y:
      3 * mt * mt * (curve.p1.y - curve.p0.y) +
      6 * mt * t * (curve.p2.y - curve.p1.y) +
      3 * t * t * (curve.p3.y - curve.p2.y),
  };
};

export const getVectorCurveTangentAt = (curve, t: number) => {
  const derivativeTangent = normalizeVectorPoint(
    getVectorCurveDerivativeAt(curve, t)
  );

  if (derivativeTangent) {
    return derivativeTangent;
  }

  const delta = 0.001;
  const currentPoint = getVectorCurvePointAt(curve, t);
  const nextT = Math.min(1, t + delta);
  const previousT = Math.max(0, t - delta);

  if (nextT > t) {
    const nextPoint = getVectorCurvePointAt(curve, nextT);
    const forwardTangent = normalizeVectorPoint({
      x: nextPoint.x - currentPoint.x,
      y: nextPoint.y - currentPoint.y,
    });

    if (forwardTangent) {
      return forwardTangent;
    }
  }

  if (previousT < t) {
    const previousPoint = getVectorCurvePointAt(curve, previousT);
    return normalizeVectorPoint({
      x: currentPoint.x - previousPoint.x,
      y: currentPoint.y - previousPoint.y,
    });
  }

  return null;
};

export const getVectorCurveLength = (
  curve,
  sampleSteps = CURVE_SAMPLE_STEPS
) => {
  let totalLength = 0;
  let previousPoint = curve.p0;

  for (let step = 1; step <= sampleSteps; step += 1) {
    const point = getVectorCurvePointAt(curve, step / sampleSteps);
    totalLength += getDistance(previousPoint, point);
    previousPoint = point;
  }

  return totalLength;
};

export const getVectorCurveParameterAtDistance = (
  curve,
  distance: number,
  options: {
    fromEnd?: boolean;
    sampleSteps?: number;
  } = {}
) => {
  const isEffectivelyLine =
    getDistanceToLine(curve.p1, curve.p0, curve.p3) <= HANDLE_EPSILON &&
    getDistanceToLine(curve.p2, curve.p0, curve.p3) <= HANDLE_EPSILON;

  if (isEffectivelyLine) {
    const totalLength = getDistance(curve.p0, curve.p3);

    if (totalLength <= DIRECTION_EPSILON) {
      return options.fromEnd ? 1 : 0;
    }

    const targetLength = options.fromEnd
      ? totalLength - clampNumber(distance, 0, totalLength)
      : clampNumber(distance, 0, totalLength);

    return targetLength / totalLength;
  }

  const sampleSteps = options.sampleSteps ?? CURVE_SAMPLE_STEPS;
  const samples = [{ length: 0, t: 0 }];
  let totalLength = 0;
  let previousPoint = curve.p0;

  for (let step = 1; step <= sampleSteps; step += 1) {
    const t = step / sampleSteps;
    const point = getVectorCurvePointAt(curve, t);
    totalLength += getDistance(previousPoint, point);
    samples.push({ length: totalLength, t });
    previousPoint = point;
  }

  if (totalLength <= DIRECTION_EPSILON) {
    return options.fromEnd ? 1 : 0;
  }

  const targetLength = options.fromEnd
    ? totalLength - clampNumber(distance, 0, totalLength)
    : clampNumber(distance, 0, totalLength);

  for (let index = 1; index < samples.length; index += 1) {
    const previousSample = samples[index - 1];
    const nextSample = samples[index];

    if (targetLength > nextSample.length) {
      continue;
    }

    const segmentLength = nextSample.length - previousSample.length;

    if (segmentLength <= DIRECTION_EPSILON) {
      return nextSample.t;
    }

    const segmentT = (targetLength - previousSample.length) / segmentLength;

    return previousSample.t + (nextSample.t - previousSample.t) * segmentT;
  }

  return 1;
};

export const splitVectorCurveAt = (curve, t: number) => {
  const q0 = lerpPoint(curve.p0, curve.p1, t);
  const q1 = lerpPoint(curve.p1, curve.p2, t);
  const q2 = lerpPoint(curve.p2, curve.p3, t);
  const r0 = lerpPoint(q0, q1, t);
  const r1 = lerpPoint(q1, q2, t);
  const s = lerpPoint(r0, r1, t);

  return {
    left: {
      p0: curve.p0,
      p1: q0,
      p2: r0,
      p3: s,
    },
    right: {
      p0: s,
      p1: r1,
      p2: q2,
      p3: curve.p3,
    },
  };
};

export const getVectorSubcurve = (curve, startT: number, endT: number) => {
  const clampedStartT = clampNumber(startT, 0, 1);
  const clampedEndT = clampNumber(endT, clampedStartT, 1);

  if (clampedEndT - clampedStartT <= DIRECTION_EPSILON) {
    return null;
  }

  let nextCurve = curve;
  let nextEndT = clampedEndT;

  if (clampedStartT > 0) {
    const split = splitVectorCurveAt(nextCurve, clampedStartT);
    nextCurve = split.right;
    nextEndT = (clampedEndT - clampedStartT) / (1 - clampedStartT);
  }

  if (nextEndT < 1) {
    const split = splitVectorCurveAt(nextCurve, nextEndT);
    return split.left;
  }

  return nextCurve;
};

export const isVectorCurveEffectivelyLine = (curve) => {
  return (
    getDistanceToLine(curve.p1, curve.p0, curve.p3) <= HANDLE_EPSILON &&
    getDistanceToLine(curve.p2, curve.p0, curve.p3) <= HANDLE_EPSILON
  );
};

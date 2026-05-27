export const GESTURE_TOLERANCES_PX = {
  placementDrag: 3,
  pointerDrag: 3,
  selectionDrag: 3,
  penDrag: 3,
  penHandleLength: 12,
  pointEpsilon: 0.5,
  vectorCornerRadiusHandleDrag: 4,
  vectorPathHit: 10,
  vectorPathPointDrag: 4,
  vectorSegmentInsertHit: 10,
  vectorSelectionMarqueeDrag: 4,
} as const;

export type GestureTolerance = keyof typeof GESTURE_TOLERANCES_PX;

export const getPointerDistanceSquared = (
  from: { x: number; y: number },
  to: { x: number; y: number }
) => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return dx * dx + dy * dy;
};

export const getPointerDistancePx = (
  from: { x: number; y: number },
  to: { x: number; y: number }
) => {
  return Math.hypot(to.x - from.x, to.y - from.y);
};

export const getGestureTolerancePx = (tolerance: GestureTolerance) => {
  return GESTURE_TOLERANCES_PX[tolerance];
};

export const getGestureToleranceSquared = (tolerance: GestureTolerance) => {
  const thresholdPx = getGestureTolerancePx(tolerance);
  return thresholdPx * thresholdPx;
};

export const isPointerDistanceAtLeast = (
  from: { x: number; y: number },
  to: { x: number; y: number },
  thresholdPx: number
) => {
  return getPointerDistanceSquared(from, to) >= thresholdPx * thresholdPx;
};

export const isPointerDistanceWithin = (
  from: { x: number; y: number },
  to: { x: number; y: number },
  thresholdPx: number
) => {
  return getPointerDistanceSquared(from, to) <= thresholdPx * thresholdPx;
};

export const hasPointerMovedAtLeast = (
  from: { x: number; y: number },
  to: { x: number; y: number },
  tolerance: GestureTolerance
) => {
  return getPointerDistanceSquared(from, to) >= getGestureToleranceSquared(tolerance);
};

export const hasPointerMovedWithin = (
  from: { x: number; y: number },
  to: { x: number; y: number },
  tolerance: GestureTolerance
) => {
  return getPointerDistanceSquared(from, to) <= getGestureToleranceSquared(tolerance);
};

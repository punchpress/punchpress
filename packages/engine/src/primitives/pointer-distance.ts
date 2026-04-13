export const getPointerDistancePx = (
  from: { x: number; y: number },
  to: { x: number; y: number }
) => {
  return Math.hypot(to.x - from.x, to.y - from.y);
};

export const isPointerDistanceAtLeast = (
  from: { x: number; y: number },
  to: { x: number; y: number },
  thresholdPx: number
) => {
  return getPointerDistancePx(from, to) >= thresholdPx;
};

export const isPointerDistanceWithin = (
  from: { x: number; y: number },
  to: { x: number; y: number },
  thresholdPx: number
) => {
  return getPointerDistancePx(from, to) <= thresholdPx;
};

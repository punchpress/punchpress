const CORNER_RADIUS_DECIMAL_PLACES = 3;
const CORNER_RADIUS_STEP = 10 ** -CORNER_RADIUS_DECIMAL_PLACES;

export const CORNER_RADIUS_MIXED_EPSILON = 0.01;

export const normalizeCornerRadius = (value: number) => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Number.parseFloat(value.toFixed(CORNER_RADIUS_DECIMAL_PLACES));
};

export const clampCornerRadius = (
  value: number,
  min = 0,
  max = Number.POSITIVE_INFINITY
) => {
  return normalizeCornerRadius(Math.min(max, Math.max(min, value || 0)));
};

export const areCornerRadiiEquivalent = (
  left: number,
  right: number,
  epsilon = CORNER_RADIUS_MIXED_EPSILON
) => {
  return (
    Math.abs(normalizeCornerRadius(left) - normalizeCornerRadius(right)) <=
    Math.max(epsilon, CORNER_RADIUS_STEP)
  );
};

const MIN_SOFT_PEAK_COVERAGE = 0.08;
const MIN_SOFT_SPACING_MULTIPLIER = 0.25;
const HARD_BRUSH_ANTIALIAS_WIDTH = 1;

const clamp = (value, min, max) => {
  return Math.min(max, Math.max(min, value));
};

const smoothstep = (edge0, edge1, value) => {
  const progress = clamp((value - edge0) / (edge1 - edge0), 0, 1);

  return progress * progress * (3 - 2 * progress);
};

export const getBrushDabCoverage = (
  normalizedDistanceSquared,
  hardness,
  radius = 0
) => {
  const normalizedHardness = clamp(hardness, 0, 1);
  const normalizedDistance = Math.sqrt(normalizedDistanceSquared);

  if (normalizedHardness >= 1) {
    if (radius <= 0) {
      return normalizedDistanceSquared > 1 ? 0 : 1;
    }

    return clamp(
      radius + HARD_BRUSH_ANTIALIAS_WIDTH / 2 - normalizedDistance * radius,
      0,
      1
    );
  }

  if (normalizedDistanceSquared > 1) {
    return 0;
  }

  const peakCoverage =
    MIN_SOFT_PEAK_COVERAGE +
    (1 - MIN_SOFT_PEAK_COVERAGE) *
      (1 - (1 - normalizedHardness) ** 4);

  const coverage =
    normalizedDistance <= normalizedHardness
      ? 1
      : 1 - smoothstep(normalizedHardness, 1, normalizedDistance);

  return clamp(coverage * peakCoverage, 0, 1);
};

export const getBrushDabSpacing = (size, spacing, hardness) => {
  const normalizedHardness = clamp(hardness, 0, 1);
  const spacingMultiplier =
    MIN_SOFT_SPACING_MULTIPLIER +
    (1 - MIN_SOFT_SPACING_MULTIPLIER) * normalizedHardness;

  return Math.max(1, size * 0.02, size * spacing * spacingMultiplier);
};

/**
 * Adaptive dab-step length for solid (hardness 1, opacity 1) stroke
 * segments. Solid segments paint exact capsules, so the step length only
 * bounds incremental work per dab, never envelope accuracy; the
 * scallop-depth bound s^2 / (8r) <= 0.4 px picks a step that would stay
 * sub-half-pixel even for stamped circles. Clamped between the regular
 * spacing floor and half the radius.
 */
export const getSolidBrushDabSpacing = (size, spacing) => {
  const radius = size / 2;
  const floor = getBrushDabSpacing(size, spacing, 1);
  const adaptive = Math.sqrt(3.2 * radius);

  return Math.max(1, Math.min(Math.max(adaptive, floor), radius / 2));
};

/**
 * Coverage of a solid brush swept along the segment `from -> to`: the
 * one-pixel antialias ramp around the capsule envelope, matching
 * getBrushDabCoverage at hardness 1 for a degenerate segment.
 */
export const getSolidBrushSegmentCoverage = (x, y, from, to, radius) => {
  const abX = to.x - from.x;
  const abY = to.y - from.y;
  const lengthSquared = abX * abX + abY * abY;
  const t =
    lengthSquared > 0
      ? clamp(((x - from.x) * abX + (y - from.y) * abY) / lengthSquared, 0, 1)
      : 0;
  const distance = Math.hypot(x - (from.x + abX * t), y - (from.y + abY * t));

  return clamp(radius + HARD_BRUSH_ANTIALIAS_WIDTH / 2 - distance, 0, 1);
};

export const getBrushDabRenderRadius = (size, hardness) => {
  const radius = size / 2;

  return hardness >= 1 ? radius + HARD_BRUSH_ANTIALIAS_WIDTH / 2 : radius;
};

export const getPaintedAlpha = (targetAlpha, sourceAlpha) => {
  const clampedTargetAlpha = clamp(targetAlpha, 0, 1);
  const clampedSourceAlpha = clamp(sourceAlpha, 0, 1);

  return (
    clampedSourceAlpha +
    clampedTargetAlpha * (1 - clampedSourceAlpha)
  );
};

export const getErasedAlpha = (targetAlpha, sourceAlpha) => {
  return clamp(targetAlpha, 0, 1) * (1 - clamp(sourceAlpha, 0, 1));
};

export const getPaintedAlphaByte = (targetAlphaByte, sourceAlpha) => {
  return Math.round(
    getPaintedAlpha(clamp(targetAlphaByte, 0, 255) / 255, sourceAlpha) * 255
  );
};

export const getErasedAlphaByte = (targetAlphaByte, sourceAlpha) => {
  return Math.round(
    getErasedAlpha(clamp(targetAlphaByte, 0, 255) / 255, sourceAlpha) * 255
  );
};

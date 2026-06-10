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

  return Math.max(1, size * spacing * spacingMultiplier);
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

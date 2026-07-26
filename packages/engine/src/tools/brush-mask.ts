import { getSampledBrushTipAsset } from "../raster/brush-tip-assets";

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

export const getBrushDabRenderBounds = (dab) => {
  const edgePadding =
    dab.tip.kind === "round" && dab.hardness >= 1
      ? HARD_BRUSH_ANTIALIAS_WIDTH / 2
      : 0;
  const radiusX = dab.size / 2 + edgePadding;
  const radiusY = (dab.size * dab.roundness) / 2 + edgePadding;
  const angle = (dab.angle * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const extentX = Math.hypot(radiusX * cos, radiusY * sin);
  const extentY = Math.hypot(radiusX * sin, radiusY * cos);

  return {
    maxX: Math.ceil(dab.center.x + extentX),
    maxY: Math.ceil(dab.center.y + extentY),
    minX: Math.floor(dab.center.x - extentX),
    minY: Math.floor(dab.center.y - extentY),
  };
};

export const getRasterDabCoverageAtPoint = (dab, point) => {
  const angle = (-dab.angle * Math.PI) / 180;
  const deltaX = point.x - dab.center.x;
  const deltaY = point.y - dab.center.y;
  const localX = deltaX * Math.cos(angle) - deltaY * Math.sin(angle);
  const localY = deltaX * Math.sin(angle) + deltaY * Math.cos(angle);
  const radiusX = dab.size / 2;
  const radiusY = (dab.size * dab.roundness) / 2;

  if (!(radiusX > 0 && radiusY > 0)) {
    return 0;
  }

  const normalizedX = localX / radiusX;
  const normalizedY = localY / radiusY;

  if (dab.tip.kind === "round") {
    return getBrushDabCoverage(
      normalizedX ** 2 + normalizedY ** 2,
      dab.hardness,
      Math.min(radiusX, radiusY)
    );
  }

  const sample = getSampledBrushTipAsset(dab.tip.sampleId);

  if (!sample || Math.abs(normalizedX) > 1 || Math.abs(normalizedY) > 1) {
    return 0;
  }

  const x = Math.min(
    sample.width - 1,
    Math.floor(((normalizedX + 1) / 2) * sample.width)
  );
  const y = Math.min(
    sample.height - 1,
    Math.floor(((normalizedY + 1) / 2) * sample.height)
  );

  return Number.parseInt(sample.alpha[y]?.[x] ?? "0", 16) / 15;
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

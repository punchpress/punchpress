import type {
  RasterDab,
  RasterPoint,
  RasterStrokeSettings,
} from "./contracts";

const RESAMPLE_EPSILON = 1e-9;

export type RasterDabGenerator = {
  append: (points: readonly RasterPoint[]) => RasterDab[];
  finish: () => RasterDab[];
};

export const createRasterDabGenerator = (
  settings: RasterStrokeSettings
): RasterDabGenerator => {
  const fixedSettings = cloneSettings(settings);
  const spacing = fixedSettings.size * fixedSettings.spacing;

  if (!(Number.isFinite(spacing) && spacing > 0)) {
    throw new Error("Raster dab spacing must be a positive finite distance");
  }

  const smoothingDistance = fixedSettings.size * fixedSettings.smoothing;
  const smoothingSampleDistance =
    smoothingDistance > 0
      ? Math.min(spacing, Math.max(0.25, smoothingDistance / 4))
      : 0;
  let distanceToNextDab = spacing;
  let distanceToNextSmoothingSample = smoothingSampleDistance;
  let finished = false;
  let lastDabPathPoint: RasterPoint | null = null;
  let lastInputPoint: RasterPoint | null = null;
  let lastSmoothingGuide: RasterPoint | null = null;
  let smoothedPoint: RasterPoint | null = null;

  const appendDabPathPoint = (point: RasterPoint, dabs: RasterDab[]) => {
    if (!lastDabPathPoint) {
      lastDabPathPoint = clonePoint(point);
      dabs.push(createDab(point, fixedSettings));
      return;
    }

    const resampled = resampleSegment({
      distanceToNext: distanceToNextDab,
      end: point,
      interval: spacing,
      start: lastDabPathPoint,
    });

    dabs.push(
      ...resampled.points.map((center) => createDab(center, fixedSettings))
    );
    distanceToNextDab = resampled.distanceToNext;
    lastDabPathPoint = clonePoint(point);
  };

  const appendSmoothingGuide = (guide: RasterPoint, dabs: RasterDab[]) => {
    if (!smoothedPoint) {
      smoothedPoint = clonePoint(guide);
    } else {
      const alpha =
        1 - Math.exp(-smoothingSampleDistance / smoothingDistance);

      smoothedPoint = interpolatePoint(smoothedPoint, guide, alpha);
    }

    lastSmoothingGuide = clonePoint(guide);
    appendDabPathPoint(smoothedPoint, dabs);
  };

  const appendInputPoint = (point: RasterPoint, dabs: RasterDab[]) => {
    if (!lastInputPoint) {
      lastInputPoint = clonePoint(point);
      lastSmoothingGuide = clonePoint(point);
      appendDabPathPoint(point, dabs);

      if (smoothingDistance > 0) {
        smoothedPoint = clonePoint(point);
      }
      return;
    }

    if (smoothingDistance === 0) {
      appendDabPathPoint(point, dabs);
      lastInputPoint = clonePoint(point);
      return;
    }

    const guides = resampleSegment({
      distanceToNext: distanceToNextSmoothingSample,
      end: point,
      interval: smoothingSampleDistance,
      start: lastInputPoint,
    });

    for (const guide of guides.points) {
      appendSmoothingGuide(guide, dabs);
    }

    distanceToNextSmoothingSample = guides.distanceToNext;
    lastInputPoint = clonePoint(point);
  };

  return {
    append: (points) => {
      if (finished) {
        throw new Error("Cannot append points to a finished Raster stroke");
      }

      const dabs: RasterDab[] = [];

      for (const point of points) {
        appendInputPoint(point, dabs);
      }

      return dabs;
    },
    finish: () => {
      if (finished) {
        return [];
      }

      finished = true;

      if (
        smoothingDistance === 0 ||
        !lastInputPoint ||
        pointsEqual(lastInputPoint, lastSmoothingGuide)
      ) {
        return [];
      }

      const dabs: RasterDab[] = [];

      appendDabPathPoint(lastInputPoint, dabs);
      return dabs;
    },
  };
};

type SegmentResampleInput = {
  distanceToNext: number;
  end: RasterPoint;
  interval: number;
  start: RasterPoint;
};

const resampleSegment = ({
  distanceToNext,
  end,
  interval,
  start,
}: SegmentResampleInput) => {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const length = Math.hypot(deltaX, deltaY);

  if (length === 0) {
    return { distanceToNext, points: [] };
  }

  const points: RasterPoint[] = [];
  let traveled = distanceToNext;

  while (traveled <= length + RESAMPLE_EPSILON) {
    points.push(interpolatePoint(start, end, Math.min(1, traveled / length)));
    traveled += interval;
  }

  return {
    distanceToNext: traveled - length,
    points,
  };
};

const createDab = (
  center: RasterPoint,
  settings: RasterStrokeSettings
): RasterDab => ({
  center: clonePoint(center),
  color: settings.color,
  hardness: settings.hardness,
  opacity: settings.opacity,
  size: settings.size,
  tip: { ...settings.tip },
});

const interpolatePoint = (
  start: RasterPoint,
  end: RasterPoint,
  progress: number
): RasterPoint => ({
  x: roundCoordinate(start.x + (end.x - start.x) * progress),
  y: roundCoordinate(start.y + (end.y - start.y) * progress),
});

const roundCoordinate = (value: number) =>
  Math.round(value * 1_000_000_000_000) / 1_000_000_000_000;

const clonePoint = (point: RasterPoint): RasterPoint => ({
  x: roundCoordinate(point.x),
  y: roundCoordinate(point.y),
});

const pointsEqual = (
  first: RasterPoint,
  second: RasterPoint | null
): boolean => first.x === second?.x && first.y === second.y;

const cloneSettings = (settings: RasterStrokeSettings): RasterStrokeSettings => ({
  ...settings,
  tip: { ...settings.tip },
});

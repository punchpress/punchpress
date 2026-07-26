import type {
  RasterDab,
  RasterPoint,
  RasterStrokeSettings,
} from "./contracts";
import { getRasterDabSpacing } from "./dab-spacing";
import { assertValidRasterDynamics } from "./settings";

const RESAMPLE_EPSILON = 1e-9;

export type RasterDabGenerator = {
  append: (points: readonly RasterPoint[]) => RasterDab[];
  finish: () => RasterDab[];
  translate: (delta: RasterPoint) => void;
};

export const createRasterDabGenerator = (
  settings: RasterStrokeSettings
): RasterDabGenerator => {
  const fixedSettings = cloneSettings(settings);
  const random = createSeededRandom(fixedSettings.seed);

  assertValidRasterDynamics(fixedSettings);

  const spacing = getRasterDabSpacing(fixedSettings);
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
  let smoothedPoint: RasterPoint | null = null;

  const appendDabPathPoint = (point: RasterPoint, dabs: RasterDab[]) => {
    if (!lastDabPathPoint) {
      lastDabPathPoint = clonePoint(point);
      dabs.push(createDab(point, fixedSettings, random));
      return;
    }

    const resampled = resampleSegment({
      distanceToNext: distanceToNextDab,
      end: point,
      interval: spacing,
      start: lastDabPathPoint,
    });

    dabs.push(
      ...resampled.points.map((center) =>
        createDab(center, fixedSettings, random)
      )
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

    appendDabPathPoint(smoothedPoint, dabs);
  };

  const appendInputPoint = (point: RasterPoint, dabs: RasterDab[]) => {
    if (!lastInputPoint) {
      lastInputPoint = clonePoint(point);
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

      assertValidRasterPoints(points, lastInputPoint);

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
        pointsEqual(lastInputPoint, lastDabPathPoint)
      ) {
        return [];
      }

      const dabs: RasterDab[] = [];

      appendDabPathPoint(lastInputPoint, dabs);
      return dabs;
    },
    translate: ({ x, y }) => {
      if (!(Number.isFinite(x) && Number.isFinite(y))) {
        throw new Error("Raster Dab translation must be finite");
      }

      lastDabPathPoint = translatePoint(lastDabPathPoint, x, y);
      lastInputPoint = translatePoint(lastInputPoint, x, y);
      smoothedPoint = translatePoint(smoothedPoint, x, y);
    },
  };
};

const translatePoint = (
  point: RasterPoint | null,
  deltaX: number,
  deltaY: number
): RasterPoint | null =>
  point ? { x: point.x + deltaX, y: point.y + deltaY } : null;

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

  if (!Number.isFinite(length)) {
    throw new Error("Raster segment length must be finite");
  }

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
  settings: RasterStrokeSettings,
  random: () => number
): RasterDab => {
  const scatterAngle = random() * Math.PI * 2;
  const scatterDistance =
    random() * settings.scatter * settings.size * 0.5;
  const size =
    settings.size * (1 - settings.sizeJitter * random());
  const angle =
    settings.angle + (random() * 2 - 1) * settings.angleJitter * 180;

  return {
    angle: roundCoordinate(angle),
    center: {
      x: roundCoordinate(center.x + Math.cos(scatterAngle) * scatterDistance),
      y: roundCoordinate(center.y + Math.sin(scatterAngle) * scatterDistance),
    },
    color: settings.color,
    flow: settings.flow,
    hardness: settings.hardness,
    opacity: settings.opacity,
    roundness: settings.roundness,
    size: roundCoordinate(size),
    tip: { ...settings.tip },
  };
};

const interpolatePoint = (
  start: RasterPoint,
  end: RasterPoint,
  progress: number
): RasterPoint => ({
  x: roundCoordinate(start.x + (end.x - start.x) * progress),
  y: roundCoordinate(start.y + (end.y - start.y) * progress),
});

const roundCoordinate = (value: number) => {
  const scaled = value * 1_000_000_000_000;

  return Number.isFinite(scaled)
    ? Math.round(scaled) / 1_000_000_000_000
    : value;
};

const clonePoint = (point: RasterPoint): RasterPoint => ({
  x: roundCoordinate(point.x),
  y: roundCoordinate(point.y),
});

const pointsEqual = (
  first: RasterPoint,
  second: RasterPoint | null
): boolean => first.x === second?.x && first.y === second.y;

const assertValidRasterPoints = (
  points: readonly RasterPoint[],
  previousPoint: RasterPoint | null
) => {
  let previous = previousPoint;

  for (const point of points) {
    if (!(Number.isFinite(point.x) && Number.isFinite(point.y))) {
      throw new Error("Raster points must use finite coordinates");
    }

    if (
      previous &&
      !Number.isFinite(Math.hypot(point.x - previous.x, point.y - previous.y))
    ) {
      throw new Error("Raster segment length must be finite");
    }

    previous = point;
  }
};

const cloneSettings = (
  settings: RasterStrokeSettings
): RasterStrokeSettings => ({
  angle: settings.angle ?? 0,
  angleJitter: settings.angleJitter ?? 0,
  color: settings.color,
  flow: settings.flow ?? 1,
  hardness: settings.hardness,
  opacity: settings.opacity,
  roundness: settings.roundness ?? 1,
  scatter: settings.scatter ?? 0,
  seed: settings.seed ?? 1,
  size: settings.size,
  sizeJitter: settings.sizeJitter ?? 0,
  smoothing: settings.smoothing,
  spacing: settings.spacing,
  tip: { ...settings.tip },
});

const createSeededRandom = (seed: number) => {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b_79f5) >>> 0;
    let value = state;

    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);

    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
};

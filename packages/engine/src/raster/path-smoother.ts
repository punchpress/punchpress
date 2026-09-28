import type { RasterPoint } from "./contracts";

const MAX_SAMPLES_PER_SEGMENT = 64;
const MIN_SAMPLE_DISTANCE = 0.25;

export type RasterPathSmoother = {
  append: (points: readonly RasterPoint[]) => RasterPoint[];
  finish: () => RasterPoint[];
  translate: (delta: RasterPoint) => void;
};

export const createRasterPathSmoother = ({
  size,
  smoothing,
}: {
  size: number;
  smoothing: number;
}): RasterPathSmoother => {
  const smoothingDistance = size * smoothing;
  const preferredSampleDistance = Math.max(
    MIN_SAMPLE_DISTANCE,
    smoothingDistance / 4
  );
  let finished = false;
  let lastEmittedPoint: RasterPoint | null = null;
  let lastInputPoint: RasterPoint | null = null;
  let smoothedPoint: RasterPoint | null = null;

  const appendPoint = (point: RasterPoint, output: RasterPoint[]) => {
    if (!lastInputPoint) {
      lastInputPoint = clonePoint(point);
      smoothedPoint = clonePoint(point);
      lastEmittedPoint = clonePoint(point);
      output.push(clonePoint(point));
      return;
    }

    const start = lastInputPoint;
    const deltaX = point.x - start.x;
    const deltaY = point.y - start.y;
    const length = Math.hypot(deltaX, deltaY);

    if (!Number.isFinite(length)) {
      throw new Error("Raster path segment length must be finite");
    }

    lastInputPoint = clonePoint(point);

    if (length === 0) {
      return;
    }

    const sampleCount = Math.min(
      MAX_SAMPLES_PER_SEGMENT,
      Math.max(1, Math.ceil(length / preferredSampleDistance))
    );
    const sampleDistance = length / sampleCount;
    const alpha = 1 - Math.exp(-sampleDistance / smoothingDistance);

    for (let index = 1; index <= sampleCount; index += 1) {
      const guide = interpolatePoint(start, point, index / sampleCount);

      smoothedPoint = interpolatePoint(smoothedPoint, guide, alpha);
      lastEmittedPoint = smoothedPoint;
      output.push(smoothedPoint);
    }
  };

  return {
    append: (points) => {
      if (finished) {
        throw new Error("Cannot append points to a finished Raster path");
      }

      assertValidPoints(points);
      const output: RasterPoint[] = [];

      for (const point of points) {
        appendPoint(point, output);
      }

      return output;
    },
    finish: () => {
      if (finished) {
        return [];
      }

      finished = true;

      if (!lastInputPoint || pointsEqual(lastInputPoint, lastEmittedPoint)) {
        return [];
      }

      lastEmittedPoint = clonePoint(lastInputPoint);
      return [clonePoint(lastInputPoint)];
    },
    translate: ({ x, y }) => {
      if (!(Number.isFinite(x) && Number.isFinite(y))) {
        throw new Error("Raster path translation must be finite");
      }

      lastEmittedPoint = translatePoint(lastEmittedPoint, x, y);
      lastInputPoint = translatePoint(lastInputPoint, x, y);
      smoothedPoint = translatePoint(smoothedPoint, x, y);
    },
  };
};

const assertValidPoints = (points: readonly RasterPoint[]) => {
  for (const point of points) {
    if (!(Number.isFinite(point.x) && Number.isFinite(point.y))) {
      throw new Error("Raster path points must use finite coordinates");
    }
  }
};

const clonePoint = (point: RasterPoint): RasterPoint => ({
  x: point.x,
  y: point.y,
});

const interpolatePoint = (
  start: RasterPoint,
  end: RasterPoint,
  progress: number
): RasterPoint => ({
  x: start.x + (end.x - start.x) * progress,
  y: start.y + (end.y - start.y) * progress,
});

const pointsEqual = (
  first: RasterPoint,
  second: RasterPoint | null
): boolean => first.x === second?.x && first.y === second.y;

const translatePoint = (
  point: RasterPoint | null,
  deltaX: number,
  deltaY: number
): RasterPoint | null =>
  point ? { x: point.x + deltaX, y: point.y + deltaY } : null;

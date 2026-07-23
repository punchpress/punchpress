import type {
  RasterCommit,
  RasterOperation,
  RasterPoint,
  RasterStrokeContext,
  RasterStrokeSettings,
  RasterSurface,
  RasterTarget,
} from "./contracts";
import { createRasterDabGenerator } from "./dab-generator";

type CreateRasterStrokeInput = {
  operation: RasterOperation;
  point: RasterPoint;
  settings: RasterStrokeSettings;
  surface: RasterSurface;
  target: RasterTarget;
};

export type RasterStroke = {
  append: (points: readonly RasterPoint[]) => void;
  cancel: () => void;
  commit: () => RasterCommit;
};

export const createRasterStroke = ({
  operation,
  point,
  settings,
  surface,
  target,
}: CreateRasterStrokeInput): RasterStroke => {
  const context = freezeContext({ operation, settings, target });
  const generator = createBoundedDabGenerator(context);
  const surfaceSession = surface.beginStroke(context);
  let state: "active" | "cancelled" | "committed" = "active";

  surfaceSession.applyDabs(generator.append([point]));

  const requireActive = () => {
    if (state !== "active") {
      throw new Error(`Raster stroke is already ${state}`);
    }
  };

  return {
    append: (points) => {
      requireActive();
      surfaceSession.applyDabs(generator.append(points));
    },
    cancel: () => {
      requireActive();
      state = "cancelled";
      surfaceSession.cancel();
    },
    commit: () => {
      requireActive();
      surfaceSession.applyDabs(generator.finish());
      state = "committed";
      return surfaceSession.commit();
    },
  };
};

const freezeContext = ({
  operation,
  settings,
  target,
}: RasterStrokeContext): RasterStrokeContext =>
  Object.freeze({
    operation,
    settings: Object.freeze({
      ...settings,
      tip: Object.freeze({ ...settings.tip }),
    }),
    target: Object.freeze({
      ...target,
      bounds: Object.freeze({ ...target.bounds }),
      pixelSize: Object.freeze({ ...target.pixelSize }),
      writableBounds: target.writableBounds
        ? Object.freeze({ ...target.writableBounds })
        : undefined,
      writablePolygon: target.writablePolygon
        ? Object.freeze(
            target.writablePolygon.map((point) => Object.freeze({ ...point }))
          )
        : undefined,
    }),
  });

const createBoundedDabGenerator = (
  context: Readonly<RasterStrokeContext>
) => {
  const writableBounds = context.target.writableBounds || context.target.bounds;
  const radius = context.settings.size / 2;
  const clipBounds = {
    maxX: writableBounds.x + writableBounds.width + radius,
    maxY: writableBounds.y + writableBounds.height + radius,
    minX: writableBounds.x - radius,
    minY: writableBounds.y - radius,
  };
  let generator: ReturnType<typeof createRasterDabGenerator> | null = null;
  let previousPoint: RasterPoint | null = null;
  let segmentWasInside = false;

  return {
    append: (points: readonly RasterPoint[]) => {
      const dabs = [];

      for (const point of points) {
        assertFinitePoint(point);
      }

      for (const point of points) {
        if (!previousPoint) {
          previousPoint = { ...point };

          if (containsTargetPoint(context, clipBounds, point, radius)) {
            generator = createRasterDabGenerator(context.settings);
            dabs.push(...generator.append([point]));
            segmentWasInside = true;
          }
          continue;
        }

        const boundsClipped = clipSegment(previousPoint, point, clipBounds);
        const clipped =
          boundsClipped && context.target.writablePolygon
            ? clipSegmentToConvexPolygon(
                boundsClipped.start,
                boundsClipped.end,
                context.target.writablePolygon,
                radius
              )
            : boundsClipped;

        if (!clipped) {
          generator = null;
          segmentWasInside = false;
          previousPoint = { ...point };
          continue;
        }

        if (!(generator && segmentWasInside)) {
          generator = createRasterDabGenerator(context.settings);
          dabs.push(...generator.append([clipped.start]));
        }

        if (
          clipped.end.x !== clipped.start.x ||
          clipped.end.y !== clipped.start.y
        ) {
          dabs.push(...generator.append([clipped.end]));
        }

        segmentWasInside = containsTargetPoint(
          context,
          clipBounds,
          point,
          radius
        );
        if (!segmentWasInside) {
          dabs.push(...generator.finish());
          generator = null;
        }
        previousPoint = { ...point };
      }

      return dabs;
    },
    finish: () => generator?.finish() || [],
  };
};

const containsTargetPoint = (
  context: Readonly<RasterStrokeContext>,
  bounds,
  point,
  radius
) =>
  containsPoint(bounds, point) &&
  (!context.target.writablePolygon ||
    isPointInsideExpandedConvexPolygon(
      point,
      context.target.writablePolygon,
      radius
    ));

const getPolygonOrientation = (polygon: readonly Readonly<RasterPoint>[]) => {
  let area = 0;

  for (let index = 0; index < polygon.length; index += 1) {
    const point = polygon[index];
    const next = polygon[(index + 1) % polygon.length];

    area += point.x * next.y - next.x * point.y;
  }

  return area >= 0 ? 1 : -1;
};

const isPointInsideExpandedConvexPolygon = (
  point: RasterPoint,
  polygon: readonly Readonly<RasterPoint>[],
  radius: number
) => {
  const orientation = getPolygonOrientation(polygon);

  return polygon.every((edgeStart, index) => {
    const edgeEnd = polygon[(index + 1) % polygon.length];
    const edgeX = edgeEnd.x - edgeStart.x;
    const edgeY = edgeEnd.y - edgeStart.y;
    const cross =
      edgeX * (point.y - edgeStart.y) -
      edgeY * (point.x - edgeStart.x);

    return orientation * cross + radius * Math.hypot(edgeX, edgeY) >= 0;
  });
};

const clipSegmentToConvexPolygon = (
  start: RasterPoint,
  end: RasterPoint,
  polygon: readonly Readonly<RasterPoint>[],
  radius: number
) => {
  const orientation = getPolygonOrientation(polygon);
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  let enter = 0;
  let exit = 1;

  for (let index = 0; index < polygon.length; index += 1) {
    const edgeStart = polygon[index];
    const edgeEnd = polygon[(index + 1) % polygon.length];
    const edgeX = edgeEnd.x - edgeStart.x;
    const edgeY = edgeEnd.y - edgeStart.y;
    const edgeLength = Math.hypot(edgeX, edgeY);
    const startDistance =
      orientation *
        (edgeX * (start.y - edgeStart.y) -
          edgeY * (start.x - edgeStart.x)) +
      radius * edgeLength;
    const direction =
      orientation * (edgeX * deltaY - edgeY * deltaX);

    if (Math.abs(direction) <= Number.EPSILON) {
      if (startDistance < 0) {
        return null;
      }
      continue;
    }

    const ratio = -startDistance / direction;

    if (direction > 0) {
      enter = Math.max(enter, ratio);
    } else {
      exit = Math.min(exit, ratio);
    }

    if (enter > exit) {
      return null;
    }
  }

  return {
    end: {
      x: start.x + deltaX * Math.min(1, exit),
      y: start.y + deltaY * Math.min(1, exit),
    },
    start: {
      x: start.x + deltaX * Math.max(0, enter),
      y: start.y + deltaY * Math.max(0, enter),
    },
  };
};

const assertFinitePoint = (point: RasterPoint) => {
  if (!(Number.isFinite(point.x) && Number.isFinite(point.y))) {
    throw new Error("Raster points must use finite coordinates");
  }
};

const containsPoint = (
  bounds: { maxX: number; maxY: number; minX: number; minY: number },
  point: RasterPoint
) =>
  point.x >= bounds.minX &&
  point.x <= bounds.maxX &&
  point.y >= bounds.minY &&
  point.y <= bounds.maxY;

const clipSegment = (
  start: RasterPoint,
  end: RasterPoint,
  bounds: { maxX: number; maxY: number; minX: number; minY: number }
) => {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  let enter = 0;
  let exit = 1;
  const tests = [
    [-deltaX, start.x - bounds.minX],
    [deltaX, bounds.maxX - start.x],
    [-deltaY, start.y - bounds.minY],
    [deltaY, bounds.maxY - start.y],
  ] as const;

  for (const [direction, distance] of tests) {
    if (direction === 0) {
      if (distance < 0) {
        return null;
      }
      continue;
    }

    const ratio = distance / direction;
    if (direction < 0) {
      enter = Math.max(enter, ratio);
    } else {
      exit = Math.min(exit, ratio);
    }

    if (enter > exit) {
      return null;
    }
  }

  return {
    end: {
      x: start.x + deltaX * exit,
      y: start.y + deltaY * exit,
    },
    start: {
      x: start.x + deltaX * enter,
      y: start.y + deltaY * enter,
    },
  };
};

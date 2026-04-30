const DEFAULT_STROKE_HIT_WIDTH = 6;

export const createPaintedHitRegion = ({
  contours,
  fill = null,
  fillRule = "nonzero",
  stroke = null,
  strokeWidth = 0,
}) => {
  return {
    contours: (contours || []).map((contour) => ({
      closed: contour.closed,
      points: contour.points || contour.segments?.map((segment) => segment.point) || [],
    })),
    filled: Boolean(fill && fill !== "none"),
    fillRule,
    stroked: Boolean(stroke && stroke !== "none" && strokeWidth > 0),
    strokeWidth,
  };
};

const isPointInBounds = (point, bounds, margin = 0) => {
  return Boolean(
    bounds &&
      point.x >= bounds.minX - margin &&
      point.x <= bounds.maxX + margin &&
      point.y >= bounds.minY - margin &&
      point.y <= bounds.maxY + margin
  );
};

const distanceToSegment = (point, a, b) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    return Math.hypot(point.x - a.x, point.y - a.y);
  }

  const t = Math.max(
    0,
    Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared)
  );
  const projection = {
    x: a.x + t * dx,
    y: a.y + t * dy,
  };

  return Math.hypot(point.x - projection.x, point.y - projection.y);
};

const distanceToContour = (point, contour) => {
  const points = contour.points || [];

  if (points.length === 0) {
    return Number.POSITIVE_INFINITY;
  }

  if (points.length === 1) {
    return Math.hypot(point.x - points[0].x, point.y - points[0].y);
  }

  let distance = Number.POSITIVE_INFINITY;
  const lastSegmentIndex = contour.closed ? points.length : points.length - 1;

  for (let index = 0; index < lastSegmentIndex; index += 1) {
    distance = Math.min(
      distance,
      distanceToSegment(point, points[index], points[(index + 1) % points.length])
    );
  }

  return distance;
};

const isPointInContourEvenOdd = (point, contour) => {
  const points = contour.points || [];
  let inside = false;

  for (let index = 0, previousIndex = points.length - 1; index < points.length; previousIndex = index, index += 1) {
    const current = points[index];
    const previous = points[previousIndex];
    const intersects =
      current.y > point.y !== previous.y > point.y &&
      point.x <
        ((previous.x - current.x) * (point.y - current.y)) /
          (previous.y - current.y || Number.EPSILON) +
          current.x;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
};

const getContourWinding = (point, contour) => {
  const points = contour.points || [];
  let winding = 0;

  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];

    if (current.y <= point.y) {
      if (next.y > point.y && isPointLeftOfSegment(point, current, next) > 0) {
        winding += 1;
      }
      continue;
    }

    if (next.y <= point.y && isPointLeftOfSegment(point, current, next) < 0) {
      winding -= 1;
    }
  }

  return winding;
};

const isPointLeftOfSegment = (point, a, b) => {
  return (b.x - a.x) * (point.y - a.y) - (point.x - a.x) * (b.y - a.y);
};

const isPointInRegionFill = (point, region) => {
  const closedContours = (region.contours || []).filter(
    (contour) => contour.closed && contour.points.length >= 3
  );

  if (region.fillRule === "evenodd") {
    return closedContours.reduce((inside, contour) => {
      return isPointInContourEvenOdd(point, contour) ? !inside : inside;
    }, false);
  }

  return (
    closedContours.reduce((winding, contour) => {
      return winding + getContourWinding(point, contour);
    }, 0) !== 0
  );
};

const hitTestRegion = (region, point, options) => {
  const margin = options.margin || 0;

  if (
    (region.filled || options.hitInside) &&
    isPointInRegionFill(point, region)
  ) {
    return true;
  }

  const strokeHitWidth = Math.max(
    region.stroked ? region.strokeWidth || 0 : 0,
    margin > 0 || region.stroked ? margin : 0,
    region.stroked ? DEFAULT_STROKE_HIT_WIDTH : 0
  );

  if (strokeHitWidth <= 0) {
    return false;
  }

  return (region.contours || []).some((contour) => {
    return distanceToContour(point, contour) <= strokeHitWidth / 2;
  });
};

const hitTestGeometryPoint = (geometry, point, options = {}) => {
  const margin = options.margin || 0;

  if (!isPointInBounds(point, geometry?.bbox, margin)) {
    return false;
  }

  if (geometry.hitRegions?.length > 0) {
    return geometry.hitRegions.some((region) => {
      return hitTestRegion(region, point, options);
    });
  }

  return Boolean(options.hitInside && isPointInBounds(point, geometry.bbox));
};

export const withNodeGeometryBehavior = (geometry) => {
  if (!geometry) {
    return null;
  }

  Object.defineProperty(geometry, "hitTestPoint", {
    configurable: true,
    enumerable: false,
    value: (point, options = {}) => hitTestGeometryPoint(geometry, point, options),
  });

  return geometry;
};

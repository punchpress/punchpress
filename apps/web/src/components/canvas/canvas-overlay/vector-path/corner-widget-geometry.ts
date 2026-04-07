import { getVectorPointCornerControl } from "@punchpress/engine";

const CORNER_WIDGET_BASE_OFFSET_PX = 30;

const clampNumber = (value, min, max) => {
  return Math.min(max, Math.max(min, value));
};

const projectPoint = (matrix, point) => {
  return {
    x: matrix.a * point.x + matrix.c * point.y + matrix.e,
    y: matrix.b * point.x + matrix.d * point.y + matrix.f,
  };
};

const projectVector = (matrix, point) => {
  return {
    x: matrix.a * point.x + matrix.c * point.y,
    y: matrix.b * point.x + matrix.d * point.y,
  };
};

const getCornerWidgetCenter = (
  geometry,
  radius,
  maxRadius = geometry.maxRadius
) => {
  const appliedRadius = clampNumber(radius, 0, maxRadius);
  const distancePerRadius = 1 / Math.sin(geometry.cornerAngle / 2);
  const currentDistancePx =
    geometry.minDistancePx +
    appliedRadius * distancePerRadius * geometry.pixelsPerLocalUnit;

  return {
    x: geometry.anchor.x + geometry.direction.x * currentDistancePx,
    y: geometry.anchor.y + geometry.direction.y * currentDistancePx,
  };
};

export type VectorCornerWidgetGeometry = ReturnType<
  typeof getVectorCornerWidgetGeometry
>;

export const getVectorCornerWidgetGeometry = ({
  contours,
  currentRadius = null,
  matrix,
  point,
}) => {
  const control = getVectorPointCornerControl(contours, point);

  if (!(control && matrix)) {
    return null;
  }

  const anchor = projectPoint(matrix, control.anchor);
  const projectedBisector = projectVector(matrix, control.bisector);
  const pixelsPerLocalUnit = Math.hypot(
    projectedBisector.x,
    projectedBisector.y
  );

  if (pixelsPerLocalUnit <= 0.0001) {
    return null;
  }

  const distancePerRadius = 1 / Math.sin(control.cornerAngle / 2);
  const screenDirection = {
    x: projectedBisector.x / pixelsPerLocalUnit,
    y: projectedBisector.y / pixelsPerLocalUnit,
  };
  const appliedCurrentRadius = clampNumber(
    typeof currentRadius === "number" ? currentRadius : control.currentRadius,
    0,
    control.maxRadius
  );
  const minDistancePx = CORNER_WIDGET_BASE_OFFSET_PX;
  const maxDistancePx =
    minDistancePx + control.maxRadius * distancePerRadius * pixelsPerLocalUnit;
  const currentDistancePx =
    minDistancePx +
    appliedCurrentRadius * distancePerRadius * pixelsPerLocalUnit;

  return {
    anchor,
    center: {
      x: anchor.x + screenDirection.x * currentDistancePx,
      y: anchor.y + screenDirection.y * currentDistancePx,
    },
    cornerAngle: control.cornerAngle,
    currentRadius: appliedCurrentRadius,
    direction: screenDirection,
    localMaxRadius: control.maxRadius,
    maxDistancePx,
    maxRadius: control.maxRadius,
    minDistancePx,
    pixelsPerLocalUnit,
  };
};

export const getVectorCornerWidgetDisplayGeometry = (
  geometry,
  currentRadius,
  maxRadius = geometry?.maxRadius ?? 0
) => {
  if (!geometry) {
    return null;
  }

  const appliedMaxRadius = Math.max(0, maxRadius || 0);
  const appliedCurrentRadius = clampNumber(currentRadius, 0, appliedMaxRadius);
  const distancePerRadius = 1 / Math.sin(geometry.cornerAngle / 2);

  return {
    ...geometry,
    center: getCornerWidgetCenter(
      geometry,
      appliedCurrentRadius,
      appliedMaxRadius
    ),
    currentRadius: appliedCurrentRadius,
    maxDistancePx:
      geometry.minDistancePx +
      appliedMaxRadius * distancePerRadius * geometry.pixelsPerLocalUnit,
    maxRadius: appliedMaxRadius,
  };
};

export const getVectorCornerRadiusFromWidgetDrag = (geometry, screenPoint) => {
  if (!(geometry && screenPoint)) {
    return 0;
  }

  const projectedDistance =
    (screenPoint.x - geometry.anchor.x) * geometry.direction.x +
    (screenPoint.y - geometry.anchor.y) * geometry.direction.y;
  const clampedDistance = clampNumber(
    projectedDistance,
    geometry.minDistancePx,
    geometry.maxDistancePx
  );
  const distancePerRadius = 1 / Math.sin(geometry.cornerAngle / 2);

  return clampNumber(
    (clampedDistance - geometry.minDistancePx) /
      (distancePerRadius * geometry.pixelsPerLocalUnit),
    0,
    geometry.maxRadius
  );
};

export const getVectorCornerRadiusFromWidgetDragDelta = (
  geometry,
  startScreenPoint,
  screenPoint,
  startRadius = geometry?.currentRadius ?? 0
) => {
  if (!(geometry && startScreenPoint && screenPoint)) {
    return 0;
  }

  const projectedDelta =
    (screenPoint.x - startScreenPoint.x) * geometry.direction.x +
    (screenPoint.y - startScreenPoint.y) * geometry.direction.y;
  const distancePerRadius = 1 / Math.sin(geometry.cornerAngle / 2);

  return clampNumber(
    startRadius +
      projectedDelta / (distancePerRadius * geometry.pixelsPerLocalUnit),
    0,
    geometry.maxRadius
  );
};

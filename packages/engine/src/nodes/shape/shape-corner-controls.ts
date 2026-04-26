import {
  areCornerRadiiEquivalent,
  clampCornerRadius,
  normalizeCornerRadius,
} from "../../primitives/corner-radius";

const MIN_CORNER_ANGLE = 0.001;

const clampNumber = (value, min, max) => {
  return Math.min(max, Math.max(min, value));
};

const getPointDistance = (from, to) => {
  return Math.hypot(to.x - from.x, to.y - from.y);
};

const getNormalizedDirection = (from, to) => {
  const length = getPointDistance(from, to);

  if (length <= 0.0001) {
    return null;
  }

  return {
    x: (to.x - from.x) / length,
    y: (to.y - from.y) / length,
  };
};

const addScaledPoint = (point, direction, distance) => {
  return {
    x: point.x + direction.x * distance,
    y: point.y + direction.y * distance,
  };
};

export const getRoundedPointShapeCorner = (points, index, cornerRadius) => {
  const point = points[index];
  const previousPoint = points[(index - 1 + points.length) % points.length];
  const nextPoint = points[(index + 1) % points.length];
  const previousDirection = getNormalizedDirection(point, previousPoint);
  const nextDirection = getNormalizedDirection(point, nextPoint);
  const previousLength = getPointDistance(point, previousPoint);
  const nextLength = getPointDistance(point, nextPoint);

  if (
    !(
      point &&
      previousPoint &&
      nextPoint &&
      previousDirection &&
      nextDirection &&
      previousLength > 0.0001 &&
      nextLength > 0.0001 &&
      cornerRadius > 0
    )
  ) {
    return null;
  }

  const cornerAngle = Math.acos(
    clampNumber(
      previousDirection.x * nextDirection.x +
        previousDirection.y * nextDirection.y,
      -1,
      1
    )
  );

  if (
    !Number.isFinite(cornerAngle) ||
    cornerAngle <= MIN_CORNER_ANGLE ||
    Math.abs(Math.PI - cornerAngle) <= MIN_CORNER_ANGLE
  ) {
    return null;
  }

  const turnAngle = Math.PI - cornerAngle;
  const maxCutDistance = Math.min(previousLength, nextLength) / 2;
  const requestedCutDistance = cornerRadius / Math.tan(cornerAngle / 2);
  const cutDistance = clampNumber(requestedCutDistance, 0, maxCutDistance);

  if (!Number.isFinite(cutDistance) || cutDistance <= 0.0001) {
    return null;
  }

  const appliedRadius = cutDistance * Math.tan(cornerAngle / 2);
  const handleLength =
    (4 / 3) * Math.tan(turnAngle / 4) * Math.max(appliedRadius, 0);
  const start = addScaledPoint(point, previousDirection, cutDistance);
  const end = addScaledPoint(point, nextDirection, cutDistance);

  return {
    appliedRadius,
    controlIn: addScaledPoint(
      start,
      {
        x: -previousDirection.x,
        y: -previousDirection.y,
      },
      handleLength
    ),
    controlOut: addScaledPoint(
      end,
      {
        x: -nextDirection.x,
        y: -nextDirection.y,
      },
      handleLength
    ),
    end,
    maxRadius: normalizeCornerRadius(
      maxCutDistance * Math.tan(cornerAngle / 2)
    ),
    start,
  };
};

const getCornerRadiusAt = (cornerRadius, cornerRadii, index) => {
  return clampCornerRadius(
    typeof cornerRadii?.[index] === "number"
      ? cornerRadii[index]
      : (cornerRadius ?? 0)
  );
};

const getEligibleShapeCornerControls = (
  points,
  cornerRadius,
  cornerRadii = null,
  selectedPoints = null
) => {
  const targetPoints =
    selectedPoints?.length > 0
      ? selectedPoints.filter((point) => point?.contourIndex === 0)
      : points?.map((_, segmentIndex) => ({
          contourIndex: 0,
          segmentIndex,
        })) || [];

  return targetPoints
    .map((point) => {
      const control = getPointShapePointCornerControl(
        points,
        point,
        cornerRadius,
        cornerRadii
      );

      return control
        ? {
            ...control,
            point,
          }
        : null;
    })
    .filter(Boolean);
};

export const buildRoundedPointShapePath = (
  points,
  cornerRadius,
  cornerRadii = null
) => {
  const corners = points.map((_, index) => {
    return getRoundedPointShapeCorner(
      points,
      index,
      getCornerRadiusAt(cornerRadius, cornerRadii, index)
    );
  });
  const startPoint = corners[0]?.start || points[0];

  return corners
    .reduce(
      (commands, corner, index) => {
        const point = points[index];

        if (!point) {
          return commands;
        }

        if (!corner) {
          commands.push(`L ${point.x} ${point.y}`);
          return commands;
        }

        commands.push(`L ${corner.start.x} ${corner.start.y}`);
        commands.push(
          `C ${corner.controlIn.x} ${corner.controlIn.y} ${corner.controlOut.x} ${corner.controlOut.y} ${corner.end.x} ${corner.end.y}`
        );
        return commands;
      },
      [`M ${startPoint.x} ${startPoint.y}`]
    )
    .concat("Z")
    .join(" ");
};

export const canRoundPointShapePoint = (points, point) => {
  if (!point) {
    return false;
  }

  return Boolean(getRoundedPointShapeCorner(points, point.segmentIndex, 1));
};

export const getPointShapePointCornerControl = (
  points,
  point,
  cornerRadius,
  cornerRadii = null
) => {
  if (!point) {
    return null;
  }

  const currentRadius = getCornerRadiusAt(
    cornerRadius,
    cornerRadii,
    point.segmentIndex
  );
  const control =
    getRoundedPointShapeCorner(
      points,
      point.segmentIndex,
      Math.max(currentRadius, 1)
    ) || null;

  if (!control) {
    return null;
  }

  return {
    ...control,
    currentRadius: clampCornerRadius(currentRadius, 0, control.maxRadius),
  };
};

export const getPointShapeCornerRadiusSummary = (
  points,
  cornerRadius,
  cornerRadii = null,
  selectedPoints = null
) => {
  const controls = getEligibleShapeCornerControls(
    points,
    cornerRadius,
    cornerRadii,
    selectedPoints
  );
  const eligibleCount = controls.length;

  if (eligibleCount === 0) {
    return null;
  }

  const max = controls.reduce((currentMax, control) => {
    return Math.min(currentMax, control.maxRadius);
  }, Number.POSITIVE_INFINITY);
  const values = controls.map((control) => {
    return clampCornerRadius(control.currentRadius ?? 0, 0, control.maxRadius);
  });
  const [firstValue = 0] = values;
  const isMixed = values.some((value) => {
    return !areCornerRadiiEquivalent(value, firstValue);
  });
  const value = isMixed
    ? null
    : normalizeCornerRadius(
        values.reduce((sum, currentValue) => sum + currentValue, 0) /
          Math.max(values.length, 1)
      );

  return {
    eligibleCount,
    isMixed,
    max: normalizeCornerRadius(max),
    value,
  };
};

export const getRoundedPolygonCorner = getRoundedPointShapeCorner;
export const buildRoundedPolygonPath = buildRoundedPointShapePath;
export const canRoundPolygonPoint = canRoundPointShapePoint;
export const getPolygonPointCornerControl = getPointShapePointCornerControl;
export const getPolygonCornerRadiusSummary = getPointShapeCornerRadiusSummary;

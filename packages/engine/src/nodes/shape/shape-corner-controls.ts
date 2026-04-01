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

export const getRoundedPolygonCorner = (points, index, cornerRadius) => {
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
    controlIn: addScaledPoint(start, {
      x: -previousDirection.x,
      y: -previousDirection.y,
    }, handleLength),
    controlOut: addScaledPoint(end, {
      x: -nextDirection.x,
      y: -nextDirection.y,
    }, handleLength),
    end,
    maxRadius: maxCutDistance * Math.tan(cornerAngle / 2),
    start,
  };
};

export const buildRoundedPolygonPath = (points, cornerRadius) => {
  const corners = points.map((_, index) => {
    return getRoundedPolygonCorner(points, index, cornerRadius);
  });
  const startPoint = corners[0]?.start || points[0];

  return corners
    .reduce((commands, corner, index) => {
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
    }, [`M ${startPoint.x} ${startPoint.y}`])
    .concat("Z")
    .join(" ");
};

export const canRoundPolygonPoint = (points, point) => {
  if (!point) {
    return false;
  }

  return Boolean(getRoundedPolygonCorner(points, point.segmentIndex, 1));
};

export const getPolygonPointCornerControl = (points, point, cornerRadius) => {
  if (!point) {
    return null;
  }

  return (
    getRoundedPolygonCorner(points, point.segmentIndex, Math.max(cornerRadius ?? 0, 1)) || null
  );
};

export const getPolygonCornerRadiusSummary = (points, cornerRadius) => {
  const controls =
    points
      ?.map((_, segmentIndex) => {
        return getPolygonPointCornerControl(
          points,
          {
            contourIndex: 0,
            segmentIndex,
          },
          cornerRadius
        );
      })
      .filter(Boolean) || [];
  const eligibleCount = controls.length;

  if (eligibleCount === 0) {
    return null;
  }

  const values = controls.map((control) => control.appliedRadius);
  const [firstValue = 0] = values;
  const isMixed = values.some((value) => value !== firstValue);
  const max = controls.reduce((currentMax, control) => {
    return Math.max(currentMax, control.maxRadius);
  }, 0);

  return {
    eligibleCount,
    isMixed,
    max,
    value: isMixed ? null : firstValue,
  };
};

import { canVectorSegmentHaveLiveCorner } from "./vector-corner-controls";

const HANDLE_EPSILON = 0.01;

const clampNumber = (value, min, max) => {
  return Math.min(max, Math.max(min, value));
};

const hasHandle = (handle) => {
  return Boolean(
    handle &&
      (Math.abs(handle.x) > HANDLE_EPSILON || Math.abs(handle.y) > HANDLE_EPSILON)
  );
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

const getPreviousSegmentIndex = (contour, segmentIndex) => {
  if (segmentIndex > 0) {
    return segmentIndex - 1;
  }

  return contour.closed ? contour.segments.length - 1 : -1;
};

const getNextSegmentIndex = (contour, segmentIndex) => {
  if (segmentIndex < contour.segments.length - 1) {
    return segmentIndex + 1;
  }

  return contour.closed ? 0 : -1;
};

const getRoundedCorner = (contour, segmentIndex) => {
  const segment = contour.segments[segmentIndex];
  const cornerRadius = segment?.cornerRadius ?? 0;

  if (!(cornerRadius > 0 && canVectorSegmentHaveLiveCorner(contour, segmentIndex))) {
    return null;
  }

  const previousSegment = contour.segments[getPreviousSegmentIndex(contour, segmentIndex)];
  const nextSegment = contour.segments[getNextSegmentIndex(contour, segmentIndex)];
  const previousDirection = getNormalizedDirection(segment.point, previousSegment.point);
  const nextDirection = getNormalizedDirection(segment.point, nextSegment.point);
  const previousLength = getPointDistance(segment.point, previousSegment.point);
  const nextLength = getPointDistance(segment.point, nextSegment.point);
  const cornerAngle = Math.acos(
    clampNumber(
      previousDirection.x * nextDirection.x +
        previousDirection.y * nextDirection.y,
      -1,
      1
    )
  );
  const maxCutDistance = Math.min(previousLength, nextLength) / 2;
  const requestedCutDistance = cornerRadius / Math.tan(cornerAngle / 2);
  const cutDistance = clampNumber(requestedCutDistance, 0, maxCutDistance);
  const appliedRadius = cutDistance * Math.tan(cornerAngle / 2);
  const turnAngle = Math.PI - cornerAngle;
  const handleLength =
    (4 / 3) * Math.tan(turnAngle / 4) * Math.max(appliedRadius, 0);
  const start = addScaledPoint(segment.point, previousDirection, cutDistance);
  const end = addScaledPoint(segment.point, nextDirection, cutDistance);

  return {
    controlIn: addScaledPoint(start, {
      x: -previousDirection.x,
      y: -previousDirection.y,
    }, handleLength),
    controlOut: addScaledPoint(end, {
      x: -nextDirection.x,
      y: -nextDirection.y,
    }, handleLength),
    end,
    start,
  };
};

const getLineCommand = (point) => {
  return {
    type: "L",
    x: point.x,
    y: point.y,
  };
};

const getCurveCommand = (corner) => {
  return {
    type: "C",
    x: corner.end.x,
    x1: corner.controlIn.x,
    x2: corner.controlOut.x,
    y: corner.end.y,
    y1: corner.controlIn.y,
    y2: corner.controlOut.y,
  };
};

const getSegmentCommand = (currentSegment, nextSegment) => {
  const control1 = addScaledPoint(currentSegment.point, currentSegment.handleOut, 1);
  const control2 = addScaledPoint(nextSegment.point, nextSegment.handleIn, 1);
  const usesCurve = hasHandle(currentSegment.handleOut) || hasHandle(nextSegment.handleIn);

  if (!usesCurve) {
    return getLineCommand(nextSegment.point);
  }

  return {
    type: "C",
    x: nextSegment.point.x,
    x1: control1.x,
    x2: control2.x,
    y: nextSegment.point.y,
    y1: control1.y,
    y2: control2.y,
  };
};

const appendContourSegmentCommand = (commands, contour, roundedCorners, segmentIndex) => {
  const previousSegment = contour.segments[segmentIndex - 1];
  const currentSegment = contour.segments[segmentIndex];
  const previousRoundedCorner = roundedCorners[segmentIndex - 1];
  const currentRoundedCorner = roundedCorners[segmentIndex];

  if (currentRoundedCorner) {
    commands.push(getLineCommand(currentRoundedCorner.start));
    commands.push(getCurveCommand(currentRoundedCorner));
    return;
  }

  if (previousRoundedCorner) {
    commands.push(getLineCommand(currentSegment.point));
    return;
  }

  commands.push(getSegmentCommand(previousSegment, currentSegment));
};

export const getVectorContourCommands = (contour) => {
  if (!contour.segments.length) {
    return [];
  }

  const roundedCorners = contour.segments.map((_, index) => {
    return getRoundedCorner(contour, index);
  });
  const firstSegment = contour.segments[0];
  const startPoint = roundedCorners[0]?.end || firstSegment.point;
  const commands = [
    {
      type: "M",
      x: startPoint.x,
      y: startPoint.y,
    },
  ];

  for (let segmentIndex = 1; segmentIndex < contour.segments.length; segmentIndex += 1) {
    appendContourSegmentCommand(commands, contour, roundedCorners, segmentIndex);
  }

  if (contour.closed) {
    const lastIndex = contour.segments.length - 1;
    const firstRoundedCorner = roundedCorners[0];
    const lastRoundedCorner = roundedCorners[lastIndex];

    if (firstRoundedCorner) {
      commands.push(getLineCommand(firstRoundedCorner.start));
      commands.push(getCurveCommand(firstRoundedCorner));
    } else if (lastRoundedCorner) {
      commands.push(getLineCommand(firstSegment.point));
    } else {
      commands.push(getSegmentCommand(contour.segments[lastIndex], firstSegment));
    }

    commands.push({ type: "Z" });
  }

  return commands;
};

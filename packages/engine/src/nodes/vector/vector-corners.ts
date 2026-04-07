import {
  getVectorCurveControlPoints,
  isVectorCurveEffectivelyLine,
} from "./vector-curve";

const getLineCommand = (point) => {
  return {
    type: "L",
    x: point.x,
    y: point.y,
  };
};

const getSegmentCommand = (contour, curveIndex) => {
  const curve = getVectorCurveControlPoints(contour, curveIndex);

  if (!curve) {
    return null;
  }

  if (isVectorCurveEffectivelyLine(curve)) {
    return getLineCommand(curve.p3);
  }

  return {
    type: "C",
    x: curve.p3.x,
    x1: curve.p1.x,
    x2: curve.p2.x,
    y: curve.p3.y,
    y1: curve.p1.y,
    y2: curve.p2.y,
  };
};

export const getVectorContourCommands = (contour) => {
  if (!contour.segments.length) {
    return [];
  }

  const firstPoint = contour.segments[0].point;
  const commands = [
    {
      type: "M",
      x: firstPoint.x,
      y: firstPoint.y,
    },
  ];
  const curveCount = contour.closed
    ? contour.segments.length
    : Math.max(contour.segments.length - 1, 0);

  for (let curveIndex = 0; curveIndex < curveCount; curveIndex += 1) {
    const segmentCommand = getSegmentCommand(contour, curveIndex);

    if (segmentCommand) {
      commands.push(segmentCommand);
    }
  }

  if (contour.closed) {
    commands.push({ type: "Z" });
  }

  return commands;
};

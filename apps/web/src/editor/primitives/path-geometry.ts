import { format } from "./math";

export const midpoint = (a, b) => {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  };
};

export const distanceToLine = (point, a, b) => {
  const denominator = Math.hypot(b.x - a.x, b.y - a.y);
  if (denominator === 0) {
    return Math.hypot(point.x - a.x, point.y - a.y);
  }

  const numerator = Math.abs(
    (b.y - a.y) * point.x - (b.x - a.x) * point.y + b.x * a.y - b.y * a.x
  );

  return numerator / denominator;
};

export const isCubicFlatEnough = (p0, p1, p2, p3, tolerance) => {
  return (
    distanceToLine(p1, p0, p3) <= tolerance &&
    distanceToLine(p2, p0, p3) <= tolerance
  );
};

export const isQuadraticFlatEnough = (p0, p1, p2, tolerance) => {
  return distanceToLine(p1, p0, p2) <= tolerance;
};

export const flattenCubic = (p0, p1, p2, p3, tolerance, out, depth) => {
  if (depth > 14 || isCubicFlatEnough(p0, p1, p2, p3, tolerance)) {
    out.push(p3);
    return;
  }

  const p01 = midpoint(p0, p1);
  const p12 = midpoint(p1, p2);
  const p23 = midpoint(p2, p3);
  const p012 = midpoint(p01, p12);
  const p123 = midpoint(p12, p23);
  const p0123 = midpoint(p012, p123);

  flattenCubic(p0, p01, p012, p0123, tolerance, out, depth + 1);
  flattenCubic(p0123, p123, p23, p3, tolerance, out, depth + 1);
};

export const flattenQuadratic = (p0, p1, p2, tolerance, out, depth) => {
  if (depth > 14 || isQuadraticFlatEnough(p0, p1, p2, tolerance)) {
    out.push(p2);
    return;
  }

  const p01 = midpoint(p0, p1);
  const p12 = midpoint(p1, p2);
  const p012 = midpoint(p01, p12);

  flattenQuadratic(p0, p01, p012, tolerance, out, depth + 1);
  flattenQuadratic(p012, p12, p2, tolerance, out, depth + 1);
};

export const commandsToContours = (commands, tolerance) => {
  const contours = [];
  let currentContour = [];
  let currentPoint = { x: 0, y: 0 };
  let contourStart = null;

  const flushContour = (closed) => {
    if (currentContour.length === 0) {
      return;
    }

    contours.push({
      closed,
      points: currentContour,
    });

    currentContour = [];
    contourStart = null;
  };

  for (const command of commands) {
    if (command.type === "M") {
      flushContour(false);
      currentPoint = { x: command.x, y: command.y };
      contourStart = { x: command.x, y: command.y };
      currentContour = [{ x: command.x, y: command.y }];
      continue;
    }

    if (command.type === "L") {
      currentPoint = { x: command.x, y: command.y };
      currentContour.push(currentPoint);
      continue;
    }

    if (command.type === "C") {
      const points = [];
      flattenCubic(
        currentPoint,
        { x: command.x1, y: command.y1 },
        { x: command.x2, y: command.y2 },
        { x: command.x, y: command.y },
        tolerance,
        points,
        0
      );
      currentContour.push(...points);
      currentPoint = { x: command.x, y: command.y };
      continue;
    }

    if (command.type === "Q") {
      const points = [];
      flattenQuadratic(
        currentPoint,
        { x: command.x1, y: command.y1 },
        { x: command.x, y: command.y },
        tolerance,
        points,
        0
      );
      currentContour.push(...points);
      currentPoint = { x: command.x, y: command.y };
      continue;
    }

    if (command.type === "Z") {
      if (contourStart) {
        currentContour.push({ x: contourStart.x, y: contourStart.y });
      }
      flushContour(true);
    }
  }

  flushContour(false);
  return contours;
};

export const getBounds = (contours) => {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const contour of contours) {
    for (const point of contour.points) {
      if (point.x < minX) {
        minX = point.x;
      }
      if (point.y < minY) {
        minY = point.y;
      }
      if (point.x > maxX) {
        maxX = point.x;
      }
      if (point.y > maxY) {
        maxY = point.y;
      }
    }
  }

  if (!(Number.isFinite(minX) && Number.isFinite(minY))) {
    return {
      minX: 0,
      minY: 0,
      maxX: 0,
      maxY: 0,
      width: 0,
      height: 0,
    };
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
};

export const mapContours = (contours, mapper) => {
  return contours.map((contour) => {
    const points = [];
    for (const point of contour.points) {
      points.push(mapper(point));
    }
    return {
      closed: contour.closed,
      points,
    };
  });
};

export const translateContours = (contours, dx, dy) => {
  return mapContours(contours, (point) => {
    return {
      x: point.x + dx,
      y: point.y + dy,
    };
  });
};

export const contoursToPath = (contours) => {
  const pathParts = [];

  for (const contour of contours) {
    if (contour.points.length === 0) {
      continue;
    }

    const [first, ...rest] = contour.points;
    const commands = [`M ${format(first.x)} ${format(first.y)}`];

    for (const point of rest) {
      commands.push(`L ${format(point.x)} ${format(point.y)}`);
    }

    if (contour.closed) {
      commands.push("Z");
    }

    pathParts.push(commands.join(" "));
  }

  return pathParts.join(" ");
};

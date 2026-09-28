interface PixelGridBounds {
  height: number;
  width: number;
  x: number;
  y: number;
}

interface PixelGridPlane {
  cellHeight: number;
  cellWidth: number;
  originX: number;
  originY: number;
}

interface PixelGridScreenProjection {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
  viewportHeight: number;
  viewportWidth: number;
}

export const getPixelGridPaths = (
  bounds: PixelGridBounds,
  plane: PixelGridPlane
) => ({
  horizontal: getAxisPath({
    axis: "horizontal",
    end: bounds.y + bounds.height,
    lineEnd: bounds.x + bounds.width,
    lineStart: bounds.x,
    origin: plane.originY,
    start: bounds.y,
    step: plane.cellHeight,
  }),
  vertical: getAxisPath({
    axis: "vertical",
    end: bounds.x + bounds.width,
    lineEnd: bounds.y + bounds.height,
    lineStart: bounds.y,
    origin: plane.originX,
    start: bounds.x,
    step: plane.cellWidth,
  }),
});

export const getVisiblePixelGridBounds = (
  bounds: PixelGridBounds,
  plane: PixelGridPlane,
  projection: PixelGridScreenProjection
) => {
  const determinant = projection.a * projection.d - projection.b * projection.c;

  if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-12) {
    return null;
  }

  const viewportCorners = [
    getLocalPoint(projection, determinant, 0, 0),
    getLocalPoint(projection, determinant, projection.viewportWidth, 0),
    getLocalPoint(projection, determinant, 0, projection.viewportHeight),
    getLocalPoint(
      projection,
      determinant,
      projection.viewportWidth,
      projection.viewportHeight
    ),
  ];
  const viewportMinX =
    Math.min(...viewportCorners.map((point) => point.x)) - plane.cellWidth;
  const viewportMaxX =
    Math.max(...viewportCorners.map((point) => point.x)) + plane.cellWidth;
  const viewportMinY =
    Math.min(...viewportCorners.map((point) => point.y)) - plane.cellHeight;
  const viewportMaxY =
    Math.max(...viewportCorners.map((point) => point.y)) + plane.cellHeight;
  const x = Math.max(bounds.x, viewportMinX);
  const y = Math.max(bounds.y, viewportMinY);
  const maxX = Math.min(bounds.x + bounds.width, viewportMaxX);
  const maxY = Math.min(bounds.y + bounds.height, viewportMaxY);

  return {
    height: Math.max(0, maxY - y),
    width: Math.max(0, maxX - x),
    x,
    y,
  };
};

const getAxisPath = ({
  axis,
  end,
  lineEnd,
  lineStart,
  origin,
  start,
  step,
}: {
  axis: "horizontal" | "vertical";
  end: number;
  lineEnd: number;
  lineStart: number;
  origin: number;
  start: number;
  step: number;
}) => {
  if (!(Number.isFinite(step) && step > 0)) {
    return "";
  }

  const firstIndex = Math.ceil((start - origin) / step);
  const lastIndex = Math.floor((end - origin) / step);
  const segments: string[] = [];

  for (let index = firstIndex; index <= lastIndex; index += 1) {
    const coordinate = formatCoordinate(origin + index * step);

    segments.push(
      axis === "vertical"
        ? `M${coordinate} ${formatCoordinate(lineStart)}V${formatCoordinate(lineEnd)}`
        : `M${formatCoordinate(lineStart)} ${coordinate}H${formatCoordinate(lineEnd)}`
    );
  }

  return segments.join("");
};

const formatCoordinate = (value: number) => Number(value.toFixed(6));

const getLocalPoint = (
  projection: PixelGridScreenProjection,
  determinant: number,
  screenX: number,
  screenY: number
) => {
  const translatedX = screenX - projection.e;
  const translatedY = screenY - projection.f;

  return {
    x: (projection.d * translatedX - projection.c * translatedY) / determinant,
    y: (-projection.b * translatedX + projection.a * translatedY) / determinant,
  };
};

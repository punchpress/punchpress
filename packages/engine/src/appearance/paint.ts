import {
  formatColor,
  type GradientStopDocument,
  type LinearGradientPaintDocument,
  MAX_GRADIENT_STOPS,
  type PaintDocument,
  parseColor,
  toRgb,
} from "@punchpress/punch-schema";

interface Box {
  height: number;
  minX: number;
  minY: number;
  width: number;
}

// The color a paint shows in single-color surfaces (fallback text, debug
// summaries): the solid color, or a gradient's first stop.
export const getPaintPrimaryColor = (paint: PaintDocument) => {
  return paint.kind === "solid" ? paint.color : paint.stops[0].color;
};

// Solid → linear keeps the color, fading it out left to right; linear → solid
// keeps the first stop and folds its opacity into the layer.
export const convertPaint = (
  paint: PaintDocument,
  kind: PaintDocument["kind"]
): { opacityScale: number; paint: PaintDocument } => {
  if (paint.kind === kind) {
    return { opacityScale: 1, paint };
  }

  if (paint.kind === "solid") {
    return {
      opacityScale: 1,
      paint: {
        end: { x: 1, y: 0.5 },
        kind: "linear-gradient",
        start: { x: 0, y: 0.5 },
        stops: [
          { color: paint.color, id: "stop-1", offset: 0, opacity: 1 },
          { color: paint.color, id: "stop-2", offset: 1, opacity: 0 },
        ],
      },
    };
  }

  return {
    opacityScale: paint.stops[0].opacity,
    paint: { color: paint.stops[0].color, kind: "solid" },
  };
};

// Clamps and stably sorts stops, keeps known ids, and allocates missing or
// duplicate ones. Returns null for input that cannot become a valid gradient.
export const normalizeLinearGradient = (
  paint: LinearGradientPaintDocument
): LinearGradientPaintDocument | null => {
  const points = [paint.start, paint.end];

  if (
    !points.every(
      (point) => Number.isFinite(point?.x) && Number.isFinite(point?.y)
    )
  ) {
    return null;
  }

  const used = new Set<string>();
  const stops: GradientStopDocument[] = [];

  for (const stop of paint.stops.slice(0, MAX_GRADIENT_STOPS)) {
    const color = parseColor(stop.color)?.color;

    if (
      !(color && Number.isFinite(stop.offset) && Number.isFinite(stop.opacity))
    ) {
      return null;
    }

    let id = typeof stop.id === "string" && stop.id ? stop.id : "";

    if (!id || used.has(id)) {
      id = allocateStopId(used);
    }

    used.add(id);
    stops.push({
      color,
      id,
      offset: clamp01(stop.offset),
      opacity: clamp01(stop.opacity),
    });
  }

  if (stops.length < 2) {
    return null;
  }

  // Array.prototype.sort is stable, so equal offsets keep their order (hard
  // color edges).
  stops.sort((a, b) => a.offset - b.offset);

  return {
    end: { x: paint.end.x, y: paint.end.y },
    kind: "linear-gradient",
    start: { x: paint.start.x, y: paint.start.y },
    stops,
  };
};

// Color and opacity of the ramp at `offset`, interpolated like SVG stops.
export const sampleGradient = (
  paint: LinearGradientPaintDocument,
  offset: number
) => {
  const { stops } = paint;
  const after = stops.findIndex((stop) => stop.offset >= offset);

  if (after <= 0) {
    const stop = after === 0 ? stops[0] : stops.at(-1);

    return { color: stop.color, opacity: stop.opacity };
  }

  const from = stops[after - 1];
  const to = stops[after];
  const span = to.offset - from.offset;
  const t = span > 0 ? (offset - from.offset) / span : 1;
  const a = toRgb(from.color);
  const b = toRgb(to.color);

  return {
    color: formatColor({
      b: a.b + (b.b - a.b) * t,
      g: a.g + (b.g - a.g) * t,
      r: a.r + (b.r - a.r) * t,
    }),
    opacity: from.opacity + (to.opacity - from.opacity) * t,
  };
};

// Adds a stop at `offset` sampled from the current ramp, so the gradient looks
// the same until the new stop is edited.
export const insertGradientStop = (
  paint: LinearGradientPaintDocument,
  offset: number
) => {
  if (paint.stops.length >= MAX_GRADIENT_STOPS) {
    return null;
  }

  const clamped = clamp01(offset);
  const sample = sampleGradient(paint, clamped);

  return normalizeLinearGradient({
    ...paint,
    stops: [
      ...paint.stops,
      {
        color: sample.color,
        id: allocateStopId(new Set(paint.stops.map((stop) => stop.id))),
        offset: clamped,
        opacity: Number(sample.opacity.toFixed(3)),
      },
    ],
  });
};

export const removeGradientStop = (
  paint: LinearGradientPaintDocument,
  stopId: string
) => {
  if (paint.stops.length <= 2) {
    return null;
  }

  return { ...paint, stops: paint.stops.filter((stop) => stop.id !== stopId) };
};

// Angle in degrees of the gradient direction in node-local units (0 = left to
// right, 90 = top to bottom), measured through the paint box so rectangular
// boxes report the angle the user sees.
export const getGradientAngle = (
  paint: LinearGradientPaintDocument,
  box: Box
) => {
  const dx = (paint.end.x - paint.start.x) * box.width;
  const dy = (paint.end.y - paint.start.y) * box.height;

  if (dx === 0 && dy === 0) {
    return 0;
  }

  return normalizeDegrees((Math.atan2(dy, dx) * 180) / Math.PI);
};

// Rotates the gradient to `angle` about the box center, keeping its physical
// length, and normalizes the endpoints back into the box's unit space. An axis
// the box has collapsed stays at its current normalized coordinates.
export const rotateGradientTo = (
  paint: LinearGradientPaintDocument,
  angle: number,
  box: Box
): LinearGradientPaintDocument => {
  const dx = (paint.end.x - paint.start.x) * box.width;
  const dy = (paint.end.y - paint.start.y) * box.height;
  const length = Math.hypot(dx, dy) || Math.hypot(box.width, box.height) || 1;
  const radians = (angle * Math.PI) / 180;
  const halfX = (Math.cos(radians) * length) / 2;
  const halfY = (Math.sin(radians) * length) / 2;
  const toUnit = (value: number, size: number, fallback: number) => {
    return size > 0 ? Number((0.5 + value / size).toFixed(6)) : fallback;
  };

  return {
    ...paint,
    end: {
      x: toUnit(halfX, box.width, paint.end.x),
      y: toUnit(halfY, box.height, paint.end.y),
    },
    start: {
      x: toUnit(-halfX, box.width, paint.start.x),
      y: toUnit(-halfY, box.height, paint.start.y),
    },
  };
};

const allocateStopId = (used: Set<string>) => {
  let index = used.size + 1;

  while (used.has(`stop-${index}`)) {
    index += 1;
  }

  return `stop-${index}`;
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const normalizeDegrees = (degrees: number) => {
  const value = Number((((degrees % 360) + 360) % 360).toFixed(6));

  return value === 360 ? 0 : value;
};

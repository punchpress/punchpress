import {
  DEFAULT_VECTOR_STROKE_LINE_CAP,
  DEFAULT_VECTOR_STROKE_LINE_JOIN,
  DEFAULT_VECTOR_STROKE_MITER_LIMIT,
  parseColor,
} from "@punchpress/punch-schema";
import { round } from "../primitives/math";
import type { Appearance, FillLayer, StrokeLayer } from "./appearance-types";

export const EMPTY_APPEARANCE: Appearance = { fills: [], strokes: [] };

interface SolidAppearanceInput {
  cap?: StrokeLayer["cap"];
  fill?: string | null;
  join?: StrokeLayer["join"];
  miterLimit?: number;
  stroke?: string | null;
  strokeWidth?: number;
}

// Builds a one-fill/one-stroke stack from CSS colors, moving any color alpha
// into the layer opacity. Producers (defaults, SVG import, conversions) use
// this so every stored color is canonical.
export const createSolidAppearance = ({
  cap = DEFAULT_VECTOR_STROKE_LINE_CAP,
  fill = null,
  join = DEFAULT_VECTOR_STROKE_LINE_JOIN,
  miterLimit = DEFAULT_VECTOR_STROKE_MITER_LIMIT,
  stroke = null,
  strokeWidth = 0,
}: SolidAppearanceInput): Appearance => {
  const fillLayer = fill ? createSolidFill(fill) : null;
  const strokeLayer =
    stroke && strokeWidth > 0
      ? createSolidStroke(stroke, strokeWidth, { cap, join, miterLimit })
      : null;

  return {
    fills: fillLayer ? [fillLayer] : [],
    strokes: strokeLayer ? [strokeLayer] : [],
  };
};

export const createSolidFill = (
  color: string,
  id = "fill-1"
): FillLayer | null => {
  const parsed = parseColor(color);

  return parsed
    ? {
        enabled: true,
        id,
        opacity: parsed.opacity,
        paint: { color: parsed.color, kind: "solid" },
      }
    : null;
};

export const createSolidStroke = (
  color: string,
  width: number,
  {
    cap = DEFAULT_VECTOR_STROKE_LINE_CAP,
    id = "stroke-1",
    join = DEFAULT_VECTOR_STROKE_LINE_JOIN,
    miterLimit = DEFAULT_VECTOR_STROKE_MITER_LIMIT,
  }: {
    cap?: StrokeLayer["cap"];
    id?: string;
    join?: StrokeLayer["join"];
    miterLimit?: number;
  } = {}
): StrokeLayer | null => {
  const parsed = parseColor(color);

  return parsed
    ? {
        align: "center",
        cap,
        enabled: true,
        id,
        join,
        miterLimit:
          miterLimit >= 1 ? miterLimit : DEFAULT_VECTOR_STROKE_MITER_LIMIT,
        opacity: parsed.opacity,
        paint: { color: parsed.color, kind: "solid" },
        width: Math.max(0, width),
      }
    : null;
};

// Next free `<prefix>-<n>` id within one node's stack.
export const createLayerId = (appearance: Appearance, prefix: string) => {
  const used = new Set(
    [...appearance.fills, ...appearance.strokes].map((layer) => layer.id)
  );
  let index = 1;

  while (used.has(`${prefix}-${index}`)) {
    index += 1;
  }

  return `${prefix}-${index}`;
};

export const scaleAppearanceStrokes = (
  appearance: Appearance,
  scale: number
): Appearance => {
  if (appearance.strokes.length === 0 || scale === 1) {
    return appearance;
  }

  return {
    ...appearance,
    strokes: appearance.strokes.map((layer) => ({
      ...layer,
      width: round(Math.max(0, layer.width * scale), 2),
    })),
  };
};

// Stack equality for mixed-value and mergeable-style checks: layer ids are
// identity, not appearance, so they are ignored.
export const areAppearancesEqual = (a: Appearance, b: Appearance) => {
  return (
    JSON.stringify(stripLayerIds(a), sortKeys) ===
    JSON.stringify(stripLayerIds(b), sortKeys)
  );
};

const sortKeys = (_key: string, value: unknown) => {
  return value && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(
        Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
      )
    : value;
};

const stripLayerIds = (appearance: Appearance) => {
  const strip = ({ id: _id, paint, ...layer }: FillLayer | StrokeLayer) => ({
    ...layer,
    paint:
      paint.kind === "linear-gradient"
        ? {
            ...paint,
            stops: paint.stops.map(({ id: _stopId, ...stop }) => stop),
          }
        : paint,
  });

  return {
    fills: appearance.fills.map(strip),
    strokes: appearance.strokes.map(strip),
  };
};

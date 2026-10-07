import { parseColor } from "./color";
import {
  DEFAULT_VECTOR_STROKE_LINE_CAP,
  DEFAULT_VECTOR_STROKE_LINE_JOIN,
  DEFAULT_VECTOR_STROKE_MITER_LIMIT,
} from "./vector-stroke-style";

const PAINT_NODE_TYPES = new Set(["path", "shape", "text"]);

// 1.8 → 1.9: folds flat fill/stroke fields into an appearance stack. Text and
// shape strokes take the round caps and joins the 1.8 canvas painted them with.
// Unparseable colors pass through unchanged so schema validation reports them.
export const upgradeNodeAppearance1_8 = (node: Record<string, unknown>) => {
  if (!PAINT_NODE_TYPES.has(String(node.type))) {
    return node;
  }

  const {
    fill,
    stroke,
    strokeLineCap,
    strokeLineJoin,
    strokeMiterLimit,
    strokeWidth,
    ...rest
  } = node;
  const width = typeof strokeWidth === "number" ? strokeWidth : 0;
  const isPath = node.type === "path";
  const fillLayer = createLayer("fill-1", fill);
  const strokeLayer = width > 0 ? createLayer("stroke-1", stroke) : null;

  return {
    ...rest,
    appearance: {
      fills: fillLayer ? [fillLayer] : [],
      strokes: strokeLayer
        ? [
            {
              ...strokeLayer,
              align: "center",
              cap: isPath
                ? (strokeLineCap ?? DEFAULT_VECTOR_STROKE_LINE_CAP)
                : DEFAULT_VECTOR_STROKE_LINE_CAP,
              join: isPath
                ? (strokeLineJoin ?? DEFAULT_VECTOR_STROKE_LINE_JOIN)
                : DEFAULT_VECTOR_STROKE_LINE_JOIN,
              miterLimit: getMiterLimit(isPath ? strokeMiterLimit : null),
              width,
            },
          ]
        : [],
    },
  };
};

// SVG renderers treat a miter limit below 1 as invalid and fall back to the
// default 4, so that is what 1.8 documents (e.g. SVG imports with 0) painted.
const getMiterLimit = (value: unknown) => {
  return typeof value === "number" && value >= 1
    ? value
    : DEFAULT_VECTOR_STROKE_MITER_LIMIT;
};

const createLayer = (id: string, value: unknown) => {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = parseColor(value);

  if (!parsed) {
    const normalized = String(value).trim().toLowerCase();

    return normalized === "none" || normalized === "transparent"
      ? null
      : {
          enabled: true,
          id,
          opacity: 1,
          paint: { color: value, kind: "solid" },
        };
  }

  return {
    enabled: true,
    id,
    opacity: parsed.opacity,
    paint: { color: parsed.color, kind: "solid" },
  };
};
